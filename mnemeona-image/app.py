from __future__ import annotations

import io
import threading
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.responses import Response

from core.config import load_config
from core.registry import ProviderRegistry
from core.models import GenerationRequest
from ollama_manager import OllamaGPUManager


app = FastAPI(
    title="Mnemeona Image API",
    version="1.0.1-modular",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "http://localhost:1421",
        "http://127.0.0.1:1421",
        "tauri://localhost",
        "http://tauri.localhost",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_config = load_config()
registry = ProviderRegistry(_config)
ollama = OllamaGPUManager(
    _config.get("gpu_coordination", {})
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
        le=8,
    )
    seed: int | None = None

    # Optional provider override from the main Mnemeona app.
    # If omitted, the backend's active_provider is used.
    provider: str | None = None

    # Settings owned by the main Mnemeona app.
    settings: dict[str, Any] = Field(
        default_factory=dict
    )


def resolve_provider(provider_id: str | None):
    if not provider_id:
        return registry.get_active()

    if provider_id == registry.active_id:
        return registry.get_active()

    manifests = {
        item["id"]: item
        for item in registry.manifests()
    }

    if provider_id not in manifests:
        raise RuntimeError(
            f"Image provider '{provider_id}' is not installed."
        )

    provider_config = _config.get(
        "providers", {}
    ).get(provider_id, {})

    if not provider_config.get("enabled", True):
        raise RuntimeError(
            f"Image provider '{provider_id}' is disabled."
        )

    # Registry exposes providers through its normal loader.
    original = registry.active_id

    try:
        registry.config["active_provider"] = provider_id
        return registry.get_active()
    finally:
        registry.config["active_provider"] = original


@app.get("/providers")
def providers():
    return registry.get_status()


@app.get("/config")
def config():
    return _config


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "mnemeona-image",
        "version": app.version,
        "providers": registry.get_status(),
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
def generate(request: GenerateRequest):
    with _generation_lock:
        unloaded_models = []

        try:
            unloaded_models = (
                ollama.unload_for_image_generation()
            )

            provider = resolve_provider(
                request.provider
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
            result.image.save(buffer, format="PNG")

            return Response(
                content=buffer.getvalue(),
                media_type="image/png",
                headers={
                    "X-Mnemeona-Seed": str(result.seed),
                    "X-Mnemeona-Provider": result.provider,
                    "X-Mnemeona-Width": str(
                        result.image.width
                    ),
                    "X-Mnemeona-Height": str(
                        result.image.height
                    ),
                    "X-Mnemeona-Ollama-Unloaded": (
                        ",".join(unloaded_models)
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


@app.on_event("shutdown")
def shutdown():
    registry.unload_all()
