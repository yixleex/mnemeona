from __future__ import annotations

import gc
from pathlib import Path
from typing import Any

import torch
from diffusers import StableDiffusionXLPipeline

from providers.base import ImageProvider


class SDXLDreamShaperProvider(ImageProvider):
    """
    Local DreamShaper XL provider.

    Designed for NVIDIA GPUs with limited VRAM.
    Only one image model should remain loaded at a time.
    """

    provider_id = "sdxl_dreamshaper"

    @property
    def id(self) -> str:
        return self.provider_id

    @property
    def name(self) -> str:
        return "DreamShaper XL"

    def __init__(
        self,
        config: dict[str, Any] | None = None,
    ) -> None:
        self.config = config or {}

        self.pipeline: (
            StableDiffusionXLPipeline | None
        ) = None

        self.model_path = Path(
            self.config.get(
                "model_path",
                Path(__file__).resolve().parents[2]
                / "models"
                / "DreamShaper_XL",
            )
        )

        configured_device = self.config.get(
            "device",
            "auto",
        )

        if (
            configured_device == "cuda"
            and torch.cuda.is_available()
        ):
            self.device = "cuda"

        elif configured_device == "cpu":
            self.device = "cpu"

        elif torch.cuda.is_available():
            self.device = "cuda"

        else:
            self.device = "cpu"

        configured_dtype = str(
            self.config.get(
                "dtype",
                "float16",
            )
        ).lower()

        if (
            self.device == "cuda"
            and configured_dtype == "float16"
        ):
            self.dtype = torch.float16

        elif (
            self.device == "cuda"
            and configured_dtype == "bfloat16"
        ):
            self.dtype = torch.bfloat16

        else:
            self.dtype = torch.float32

    @property
    def loaded(self) -> bool:
        return self.pipeline is not None

    def _cleanup_cuda(self) -> None:
        gc.collect()

        if not torch.cuda.is_available():
            return

        try:
            torch.cuda.synchronize()
        except Exception:
            pass

        try:
            torch.cuda.empty_cache()
        except Exception:
            pass

        try:
            torch.cuda.ipc_collect()
        except Exception:
            pass

        gc.collect()

    def load(self) -> None:
        if self.pipeline is not None:
            return

        if not self.model_path.exists():
            raise FileNotFoundError(
                "DreamShaper XL model was not found at "
                f"{self.model_path}"
            )

        if not (
            self.model_path / "model_index.json"
        ).exists():
            raise RuntimeError(
                "DreamShaper XL model installation appears "
                "incomplete. Missing model_index.json at "
                f"{self.model_path}"
            )

        self._cleanup_cuda()

        print(
            "Loading DreamShaper XL from:"
            f" {self.model_path}"
        )

        self.pipeline = (
            StableDiffusionXLPipeline.from_pretrained(
                str(self.model_path),
                torch_dtype=self.dtype,
                local_files_only=True,
                use_safetensors=True,
            )
        )

        if self.device == "cuda":
            #
            # CPU offload is important for the RTX 3060 12 GB.
            #
            # It keeps parts of the SDXL pipeline on system RAM
            # instead of requiring the entire pipeline to remain
            # resident in VRAM.
            #
            self.pipeline.enable_model_cpu_offload()

        else:
            self.pipeline.to(self.device)

        #
        # Memory optimizations.
        #

        settings = self.config.get(
            "settings",
            {},
        )

        if not isinstance(settings, dict):
            settings = {}

        if settings.get(
            "attention_slicing",
            True,
        ):
            try:
                self.pipeline.enable_attention_slicing()
            except Exception:
                pass

        if settings.get(
            "vae_slicing",
            True,
        ):
            try:
                self.pipeline.enable_vae_slicing()
            except Exception:
                pass

        if settings.get(
            "vae_tiling",
            True,
        ):
            try:
                self.pipeline.enable_vae_tiling()
            except Exception:
                pass

        self.pipeline.set_progress_bar_config(
            disable=True
        )

        print(
            "DreamShaper XL loaded."
        )

        self._print_vram_status()

    def unload(self) -> None:
        if self.pipeline is None:
            return

        print(
            "Unloading DreamShaper XL..."
        )

        pipeline = self.pipeline
        self.pipeline = None

        try:
            pipeline.to("cpu")
        except Exception:
            pass

        del pipeline

        self._cleanup_cuda()

        print(
            "DreamShaper XL unloaded."
        )

        self._print_vram_status()

    def status(self) -> dict[str, Any]:
        status: dict[str, Any] = {
            "loaded": self.loaded,
            "model_exists": (
                self.model_path.exists()
                and (
                    self.model_path
                    / "model_index.json"
                ).exists()
            ),
            "device": self.device,
            "dtype": str(self.dtype),
            "model": self.name,
            "model_path": str(
                self.model_path
            ),
        }

        if torch.cuda.is_available():
            try:
                free, total = (
                    torch.cuda.mem_get_info()
                )

                status.update(
                    {
                        "gpu": (
                            torch.cuda.get_device_name(
                                0
                            )
                        ),
                        "vram_total_gb": round(
                            total / 1024**3,
                            2,
                        ),
                        "vram_free_gb": round(
                            free / 1024**3,
                            2,
                        ),
                    }
                )

            except Exception:
                pass

        return status

    def generate(
        self,
        request: Any,
    ) -> Any:
        self.load()

        if self.pipeline is None:
            raise RuntimeError(
                "DreamShaper XL pipeline failed "
                "to load."
            )

        prompt = str(
            getattr(
                request,
                "prompt",
                "",
            )
            or ""
        ).strip()

        if not prompt:
            raise ValueError(
                "Image prompt cannot be empty."
            )

        width = int(
            getattr(
                request,
                "width",
                768,
            )
            or 768
        )

        height = int(
            getattr(
                request,
                "height",
                768,
            )
            or 768
        )

        steps = int(
            getattr(
                request,
                "steps",
                25,
            )
            or 25
        )

        settings = getattr(
            request,
            "settings",
            {},
        )

        if not isinstance(
            settings,
            dict,
        ):
            settings = {}

        provider_settings = (
            self.config.get(
                "settings",
                {},
            )
        )

        if not isinstance(
            provider_settings,
            dict,
        ):
            provider_settings = {}

        guidance_scale = float(
            settings.get(
                "guidance_scale",
                provider_settings.get(
                    "guidance_scale",
                    7.5,
                ),
            )
        )

        negative_prompt = str(
            settings.get(
                "negative_prompt",
                provider_settings.get(
                    "negative_prompt",
                    (
                        "text, letters, words, "
                        "captions, logo, watermark, "
                        "signature, worst quality, "
                        "low quality, blurry, "
                        "distorted, deformed, "
                        "bad anatomy, bad proportions, "
                        "extra fingers, missing fingers, "
                        "extra limbs, malformed hands, "
                        "duplicate person"
                    ),
                ),
            )
            or ""
        )

        seed_value = settings.get(
            "seed"
        )

        width = max(
            512,
            min(width, 1024),
        )

        height = max(
            512,
            min(height, 1024),
        )

        steps = max(
            1,
            min(steps, 50),
        )

        if seed_value is None:
            generator = torch.Generator(
                device=self.device
            )
        else:
            generator = (
                torch.Generator(
                    device=self.device
                ).manual_seed(
                    int(seed_value)
                )
            )

        print(
            "Generating with DreamShaper XL:"
        )

        print(
            f"  size: {width}x{height}"
        )

        print(
            f"  steps: {steps}"
        )

        print(
            f"  guidance: {guidance_scale}"
        )

        result = self.pipeline(
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            num_inference_steps=steps,
            guidance_scale=guidance_scale,
            generator=generator,
        )

        image = result.images[0]

        seed = None

        if seed_value is not None:
            seed = int(seed_value)

        return {
            "image": image,
            "seed": seed,
            "provider": self.provider_id,
            "width": width,
            "height": height,
        }

    @staticmethod
    def _print_vram_status() -> None:
        if not torch.cuda.is_available():
            return

        try:
            free, total = (
                torch.cuda.mem_get_info()
            )

            print(
                "VRAM: "
                f"{free / 1024**3:.2f} GB free / "
                f"{total / 1024**3:.2f} GB total"
            )

        except Exception:
            pass
