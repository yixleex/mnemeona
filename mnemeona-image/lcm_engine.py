from __future__ import annotations

import gc
import os
import threading
from pathlib import Path
from typing import Optional

import torch
from PIL import Image


class LCMEngine:
    def __init__(
        self,
        model_path: str | Path,
    ) -> None:
        self.model_path = Path(
            model_path
        )

        self._pipeline = None

        self._lock = threading.Lock()

        self.device = (
            "cuda"
            if torch.cuda.is_available()
            else "cpu"
        )

        if self.device == "cuda":
            self.dtype = torch.float16
        else:
            self.dtype = torch.float32

    def status(self) -> dict:
        gpu = None
        vram_total = None
        vram_free = None

        if torch.cuda.is_available():
            gpu = (
                torch.cuda.get_device_name(0)
            )

            props = (
                torch.cuda.get_device_properties(
                    0
                )
            )

            vram_total = round(
                props.total_memory
                / 1024**3,
                2,
            )

            free, total = (
                torch.cuda.mem_get_info()
            )

            vram_free = round(
                free / 1024**3,
                2,
            )

        return {
            "loaded":
                self._pipeline is not None,

            "device":
                self.device,

            "dtype":
                str(self.dtype),

            "gpu":
                gpu,

            "vram_total_gb":
                vram_total,

            "vram_free_gb":
                vram_free,

            "model":
                "LCM_DreamShaper_v7",

            "model_path":
                str(
                    self.model_path
                ),
        }

    def load(self) -> None:
        if (
            self._pipeline
            is not None
        ):
            return

        if not self.model_path.exists():
            raise RuntimeError(
                "LCM DreamShaper v7 model "
                f"was not found at "
                f"{self.model_path}"
            )

        print(
            "Loading "
            "LCM DreamShaper v7..."
        )

        from diffusers import (
            DiffusionPipeline,
        )

        pipe = (
            DiffusionPipeline
            .from_pretrained(
                str(
                    self.model_path
                ),
                torch_dtype=(
                    self.dtype
                ),
            )
        )

        if (
            self.device ==
            "cuda"
        ):
            pipe.enable_model_cpu_offload()
        else:
            pipe.to("cpu")

        self._pipeline = pipe

        print(
            "LCM DreamShaper v7 loaded."
        )

    def unload(self) -> None:
        if (
            self._pipeline
            is None
        ):
            return

        self._pipeline = None

        gc.collect()

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()

    def generate(
        self,
        prompt: str,
        width: int = 768,
        height: int = 768,
        steps: int = 4,
        seed: Optional[int] = None,
    ) -> tuple[
        Image.Image,
        int,
    ]:
        if not prompt.strip():
            raise ValueError(
                "Prompt cannot be empty."
            )

        if width < 512:
            raise ValueError(
                "Width must be at least 512."
            )

        if height < 512:
            raise ValueError(
                "Height must be at least 512."
            )

        if width > 1024:
            raise ValueError(
                "Width above 1024 is not "
                "recommended for this model."
            )

        if height > 1024:
            raise ValueError(
                "Height above 1024 is not "
                "recommended for this model."
            )

        if steps < 1 or steps > 8:
            raise ValueError(
                "LCM steps must be "
                "between 1 and 8."
            )

        if seed is None:
            seed = int.from_bytes(
                os.urandom(4),
                "little",
            )

        with self._lock:
            self.load()

            generator = (
                torch.Generator(
                    device=(
                        "cuda"
                        if self.device ==
                        "cuda"
                        else "cpu"
                    )
                ).manual_seed(
                    seed
                )
            )

            result = self._pipeline(
                prompt=prompt,
                height=height,
                width=width,
                num_inference_steps=steps,
                guidance_scale=8.0,
                lcm_origin_steps=50,
                generator=generator,
            )

            image = (
                result.images[0]
            )

            return (
                image,
                seed,
            )
