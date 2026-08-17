from __future__ import annotations

import io
import threading
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.responses import Response

from core.config import (
    load_config,
    save_config,
)
from core.models import GenerationRequest
from core.registry import ProviderRegistry
from ollama_manager import OllamaGPUManager


app = FastAPI(
    title="Mnemeona Image API",
    version="2.1.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


_config = load_config()

registry = ProviderRegistry(
    _config
)

ollama = OllamaGPUManager(
    _config.get(
        "gpu_coordination",
        {},
    )
)

_generation_lock = threading.Lock()


class GenerateRequest(BaseModel):
    prompt: str = Field(
        min_length=1,
        max_length=20000,
    )

    width: int = Field(
        default=768,
        ge=512,
        le=1024,
    )

    height: int = Field(
        default=768,
        ge=512,
        le=1024,
    )

    steps: int = Field(
        default=4,
        ge=1,
        le=30,
    )

    seed: int | None = None

    provider: str | None = None

    settings: dict[str, Any] = Field(
        default_factory=dict
    )


class SwitchProviderRequest(BaseModel):
    provider: str = Field(
        min_length=1,
        max_length=100,
    )


def get_provider(
    provider_id: str | None,
):
    if provider_id:
        return (
            registry
            .ensure_only_loaded(
                provider_id
            )
        )

    return (
        registry
        .ensure_only_loaded(
            registry.active_id
        )
    )


@app.get("/providers")
def providers():
    return registry.get_status()


@app.post("/providers/switch")
def switch_provider(
    request: SwitchProviderRequest,
):
    with _generation_lock:
        try:
            result = registry.switch(
                request.provider
            )

            save_config(
                _config
            )

            return {
                **result,
                "status": (
                    registry
                    .get_status()
                ),
            }

        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=str(exc),
            ) from exc


@app.post(
    "/providers/{provider_id}/unload"
)
def unload_provider(
    provider_id: str,
):
    with _generation_lock:
        try:
            if provider_id not in (
                registry._manifests
            ):
                raise RuntimeError(
                    f"Unknown image provider: "
                    f"{provider_id}"
                )

            registry.unload_all()

            return {
                "ok": True,
                "provider": provider_id,
                "loaded_provider": (
                    registry
                    .loaded_provider_id
                ),
                "status": (
                    registry
                    .get_status()
                ),
            }

        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=str(exc),
            ) from exc


@app.get(
    "/providers/{provider_id}/status"
)
def provider_status(
    provider_id: str,
):
    try:
        return {
            "id": provider_id,
            "status": (
                registry
                .get_provider_status(
                    provider_id
                )
            ),
        }

    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc


@app.get(
    "/providers/{provider_id}/settings"
)
def provider_settings(
    provider_id: str,
):
    try:
        return {
            "id": provider_id,
            "schema": (
                registry
                .get_settings_schema(
                    provider_id
                )
            ),
        }

    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc


@app.get("/config")
def config():
    return _config


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "mnemeona-image",
        "version": app.version,
        "providers": (
            registry.get_status()
        ),
        "ollama": ollama.status(),
    }


@app.get("/status")
def status():
    return {
        **registry.get_status(),
        "ollama": ollama.status(),
    }


@app.get("/gpu-status")
def gpu_status():
    return {
        "image": registry.get_status(),
        "ollama": ollama.status(),
    }


@app.post("/generate")
def generate(
    request: GenerateRequest,
):
    with _generation_lock:
        unloaded_models = []

        try:
            unloaded_models = (
                ollama
                .unload_for_image_generation()
            )

            provider_id = (
                request.provider
                or registry.active_id
            )

            provider = get_provider(
                provider_id
            )

            result = provider.generate(
                GenerationRequest(
                    prompt=request.prompt,
                    width=request.width,
                    height=request.height,
                    steps=request.steps,
                    seed=request.seed,
                    settings=request.settings,
                )
            )

            buffer = io.BytesIO()

            result.image.save(
                buffer,
                format="PNG",
            )

            return Response(
                content=buffer.getvalue(),
                media_type="image/png",
                headers={
                    "X-Mnemeona-Seed": str(
                        result.seed
                    ),
                    "X-Mnemeona-Provider": (
                        result.provider
                    ),
                    "X-Mnemeona-Width": str(
                        result.image.width
                    ),
                    "X-Mnemeona-Height": str(
                        result.image.height
                    ),
                    "X-Mnemeona-Ollama-Unloaded": (
                        ",".join(
                            unloaded_models
                        )
                    ),
                },
            )

        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=str(exc),
            ) from exc

        finally:
            try:
                registry.unload_all()
            finally:
                ollama.restore_after_image_generation()


@app.post("/unload")
def unload_all():
    with _generation_lock:
        try:
            registry.unload_all()

            return {
                "ok": True,
                "message": (
                    "All image models unloaded "
                    "and GPU memory released."
                ),
                "status": (
                    registry
                    .get_status()
                ),
            }

        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=str(exc),
            ) from exc


@app.on_event("shutdown")
def shutdown():
    registry.unload_all()
