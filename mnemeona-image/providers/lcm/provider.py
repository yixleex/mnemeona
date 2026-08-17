from __future__ import annotations

import gc
import os
from pathlib import Path
from typing import Any

import torch

from core.config import resolve_model_path
from core.models import (
    GenerationRequest,
    GenerationResult,
)
from providers.base import ImageProvider


class LCMProvider(ImageProvider):
    def __init__(
        self,
        config: dict[str, Any],
    ) -> None:
        self.config = config

        self.settings = dict(
            config.get(
                "settings",
                {},
            )
        )

        self._pipeline = None

        configured_device = config.get(
            "device",
            "auto",
        )

        if configured_device == "auto":
            configured_device = (
                "cuda"
                if torch.cuda.is_available()
                else "cpu"
            )

        if (
            configured_device == "cuda"
            and not torch.cuda.is_available()
        ):
            raise RuntimeError(
                "LCM is configured for CUDA, "
                "but CUDA is not available."
            )

        self.device = (
            configured_device
        )

        configured_dtype = config.get(
            "dtype",
            "float16",
        )

        if configured_dtype == "float16":
            self.dtype = torch.float16
        elif configured_dtype == "float32":
            self.dtype = torch.float32
        elif configured_dtype == "bfloat16":
            self.dtype = torch.bfloat16
        else:
            raise RuntimeError(
                f"Unsupported LCM dtype: "
                f"{configured_dtype}"
            )

        model_path = (
            os.getenv(
                "MNEMEONA_LCM_MODEL"
            )
            or config.get(
                "model_path",
                "./models/LCM_Dreamshaper_v7",
            )
        )

        self.model_path = (
            resolve_model_path(
                model_path
            )
        )

    @property
    def id(self) -> str:
        return "lcm"

    @property
    def name(self) -> str:
        return "LCM DreamShaper v7"

    @property
    def version(self) -> str:
        return "1.0.0"

    def settings_schema(
        self,
    ) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "guidance_scale": {
                    "type": "number",
                    "title": "Guidance Scale",
                    "default": 8.0,
                    "minimum": 0.0,
                    "maximum": 20.0,
                    "step": 0.5,
                },
                "lcm_origin_steps": {
                    "type": "integer",
                    "title": "LCM Origin Steps",
                    "default": 50,
                    "minimum": 1,
                    "maximum": 100,
                },
                "attention_slicing": {
                    "type": "boolean",
                    "title": "Attention Slicing",
                    "default": True,
                },
                "vae_slicing": {
                    "type": "boolean",
                    "title": "VAE Slicing",
                    "default": True,
                },
                "vae_tiling": {
                    "type": "boolean",
                    "title": "VAE Tiling",
                    "default": True,
                },
            },
        }

    def status(
        self,
    ) -> dict[str, Any]:
        gpu = None
        vram_total = None
        vram_free = None

        if torch.cuda.is_available():
            gpu = (
                torch.cuda
                .get_device_name(0)
            )

            props = (
                torch.cuda
                .get_device_properties(0)
            )

            vram_total = round(
                props.total_memory
                / 1024**3,
                2,
            )

            free, _ = (
                torch.cuda.mem_get_info()
            )

            vram_free = round(
                free / 1024**3,
                2,
            )

        return {
            "loaded": (
                self._pipeline is not None
            ),
            "model_exists": (
                self.model_path.exists()
            ),
            "device": self.device,
            "dtype": str(
                self.dtype
            ),
            "gpu": gpu,
            "vram_total_gb": vram_total,
            "vram_free_gb": vram_free,
            "model": self.name,
            "model_path": str(
                self.model_path
            ),
        }

    def load(self) -> None:
        if self._pipeline is not None:
            return

        if not self.model_path.exists():
            raise RuntimeError(
                "LCM model was not found at "
                f"{self.model_path}\n\n"
                "Set the model location in "
                "config/image-ai.json or use:\n"
                "MNEMEONA_LCM_MODEL=/path/to/model"
            )

        from diffusers import (
            DiffusionPipeline,
        )

        print(
            f"Loading {self.name} "
            f"from {self.model_path}..."
        )

        pipe = (
            DiffusionPipeline.from_pretrained(
                str(self.model_path),
                torch_dtype=self.dtype,
            )
        )

        if self.device == "cuda":
            pipe.enable_model_cpu_offload()

            if self.settings.get(
                "attention_slicing",
                True,
            ):
                pipe.enable_attention_slicing()

            if (
                self.settings.get(
                    "vae_slicing",
                    True,
                )
                and hasattr(
                    pipe,
                    "enable_vae_slicing",
                )
            ):
                pipe.enable_vae_slicing()

            if (
                self.settings.get(
                    "vae_tiling",
                    True,
                )
                and hasattr(
                    pipe,
                    "enable_vae_tiling",
                )
            ):
                pipe.enable_vae_tiling()

        else:
            pipe.to("cpu")

        self._pipeline = pipe

        print(
            f"{self.name} loaded."
        )

    def unload(self) -> None:
        if self._pipeline is None:
            return

        self._pipeline = None

        gc.collect()

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()

    def generate(
        self,
        request: GenerationRequest,
    ) -> GenerationResult:
        if not request.prompt.strip():
            raise ValueError(
                "Prompt cannot be empty."
            )

        if not 512 <= request.width <= 1024:
            raise ValueError(
                "Width must be between "
                "512 and 1024."
            )

        if not 512 <= request.height <= 1024:
            raise ValueError(
                "Height must be between "
                "512 and 1024."
            )

        if not 1 <= request.steps <= 8:
            raise ValueError(
                "LCM steps must be between "
                "1 and 8."
            )

        seed = request.seed

        if seed is None:
            seed = int.from_bytes(
                os.urandom(4),
                "little",
            )

        self.load()

        generator_device = (
            "cuda"
            if self.device == "cuda"
            else "cpu"
        )

        generator = (
            torch.Generator(
                device=generator_device
            ).manual_seed(seed)
        )

        settings = {
            **self.settings,
            **request.settings,
        }

        result = self._pipeline(
            prompt=request.prompt,
            height=request.height,
            width=request.width,
            num_inference_steps=request.steps,
            guidance_scale=float(
                settings.get(
                    "guidance_scale",
                    8.0,
                )
            ),
            lcm_origin_steps=int(
                settings.get(
                    "lcm_origin_steps",
                    50,
                )
            ),
            generator=generator,
        )

        return GenerationResult(
            image=result.images[0],
            seed=seed,
            provider=self.id,
            metadata={
                "model": self.name,
                "settings": settings,
            },
        )
