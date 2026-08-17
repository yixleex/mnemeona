from __future__ import annotations

import gc
import os
import threading
from pathlib import Path
from typing import Optional

import torch
from PIL import Image


class ZImageEngine:
    def __init__(
        self,
        model_path: str | Path,
    ) -> None:
        self.model_path = Path(model_path)

        self._pipeline = None

        self._lock = threading.Lock()

        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        if self.device == "cuda":
            self.dtype = torch.bfloat16
        else:
            self.dtype = torch.float32

    def status(self) -> dict:
        gpu = None
        vram_total = None
        vram_free = None

        if torch.cuda.is_available():
            gpu = torch.cuda.get_device_name(0)

            vram_total = round(
                torch.cuda.get_device_properties(0).total_memory
                / 1024**3,
                2,
            )

            free, total = torch.cuda.mem_get_info()

            vram_free = round(
                free / 1024**3,
                2,
            )

        return {
            "loaded": self._pipeline is not None,
            "device": self.device,
            "dtype": str(self.dtype),
            "gpu": gpu,
            "vram_total_gb": vram_total,
            "vram_free_gb": vram_free,
            "model_path": str(self.model_path),
        }

    def load(self) -> None:
        if self._pipeline is not None:
            return

        if not self.model_path.exists():
            raise RuntimeError(
                f"Z-Image-Turbo model was not found at "
                f"{self.model_path}"
            )

        print(
            f"Loading Z-Image-Turbo from {self.model_path}"
        )

        from diffusers import ZImagePipeline

        pipe = ZImagePipeline.from_pretrained(
            str(self.model_path),
            torch_dtype=self.dtype,
        )

        if self.device == "cuda":
            pipe.enable_model_cpu_offload()
        else:
            pipe.to("cpu")

        self._pipeline = pipe

        print("Z-Image-Turbo loaded.")

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
        prompt: str,
        width: int = 1024,
        height: int = 1024,
        steps: int = 8,
        seed: Optional[int] = None,
    ) -> tuple[Image.Image, int]:
        if not prompt.strip():
            raise ValueError(
                "Prompt cannot be empty."
            )

        if width < 512 or height < 512:
            raise ValueError(
                "Image dimensions must be at least 512×512."
            )

        if width > 1536 or height > 1536:
            raise ValueError(
                "Image dimensions above 1536 are not supported."
            )

        if steps < 1 or steps > 20:
            raise ValueError(
                "Steps must be between 1 and 20."
            )

        if seed is None:
            seed = int.from_bytes(
                os.urandom(4),
                "little",
            )

        with self._lock:
            self.load()

            generator = torch.Generator(
                device="cuda"
                if self.device == "cuda"
                else "cpu"
            ).manual_seed(seed)

            result = self._pipeline(
                prompt=prompt,
                height=height,
                width=width,
                num_inference_steps=steps,
                guidance_scale=0.0,
                generator=generator,
            )

            image = result.images[0]

            return image, seed
