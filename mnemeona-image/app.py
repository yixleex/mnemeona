from __future__ import annotations

import io
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.responses import Response

from lcm_engine import LCMEngine


ROOT = Path(
    __file__
).resolve().parent


MODEL_PATH = Path(
    os.environ.get(
        "MNEMEONA_IMAGE_MODEL",
        ROOT
        / "models"
        / "LCM_Dreamshaper_v7",
    )
)


app = FastAPI(
    title="Mnemeona Image API",
    version="0.2.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # Vite development server
        "http://localhost:1420",
        "http://127.0.0.1:1420",

        # Vite HMR
        "http://localhost:1421",
        "http://127.0.0.1:1421",

        # Tauri
        "tauri://localhost",
        "http://tauri.localhost",

        # Older/default Vite development ports
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


engine = LCMEngine(
    MODEL_PATH
)


class GenerateRequest(
    BaseModel
):
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
        "service":
            "mnemeona-image",
        "model":
            "LCM_DreamShaper_v7",
        "status":
            engine.status(),
    }


@app.get("/status")
def status():
    return engine.status()


@app.post("/generate")
def generate(
    request:
        GenerateRequest,
):
    try:
        image, seed = (
            engine.generate(
                prompt=
                    request.prompt,

                width=
                    request.width,

                height=
                    request.height,

                steps=
                    request.steps,

                seed=
                    request.seed,
            )
        )

        buffer = (
            io.BytesIO()
        )

        image.save(
            buffer,
            format="PNG",
        )

        return Response(
            content=
                buffer.getvalue(),

            media_type=
                "image/png",

            headers={
                "X-Mnemeona-Seed":
                    str(seed),

                "X-Mnemeona-Width":
                    str(image.width),

                "X-Mnemeona-Height":
                    str(image.height),
            },
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        ) from exc
