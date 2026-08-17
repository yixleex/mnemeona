from __future__ import annotations

import io
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.responses import Response

from lcm_engine import LCMEngine
from ollama_manager import OllamaGPUManager


ROOT = Path(__file__).resolve().parent

MODEL_PATH = Path(
    os.environ.get(
        "MNEMEONA_IMAGE_MODEL",
        ROOT / "models" / "LCM_Dreamshaper_v7",
    )
)

app = FastAPI(
    title="Mnemeona Image API",
    version="0.3.0",
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

engine = LCMEngine(MODEL_PATH)
ollama = OllamaGPUManager()


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


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "mnemeona-image",
        "model": "LCM_DreamShaper_v7",
        "status": engine.status(),
        "ollama": ollama.status(),
    }


@app.get("/status")
def status():
    return {
        **engine.status(),
        "ollama": ollama.status(),
    }


@app.get("/gpu-status")
def gpu_status():
    return {
        "image": engine.status(),
        "ollama": ollama.status(),
    }


@app.post("/generate")
def generate(request: GenerateRequest):
    unloaded_models: list[str] = []

    try:
        # IMPORTANT:
        # Ollama keeps models in VRAM by default. Evict the
        # currently running Story AI before loading the image model.
        unloaded_models = (
            ollama.unload_for_image_generation()
        )

        image, seed = engine.generate(
            prompt=request.prompt,
            width=request.width,
            height=request.height,
            steps=request.steps,
            seed=request.seed,
        )

        buffer = io.BytesIO()

        image.save(
            buffer,
            format="PNG",
        )

        return Response(
            content=buffer.getvalue(),
            media_type="image/png",
            headers={
                "X-Mnemeona-Seed": str(seed),
                "X-Mnemeona-Width": str(image.width),
                "X-Mnemeona-Height": str(image.height),
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
        # The image engine is no longer needed once the PNG has
        # been produced, so free its VRAM before restoring Ollama.
        try:
            engine.unload()
        finally:
            ollama.restore_after_image_generation()
