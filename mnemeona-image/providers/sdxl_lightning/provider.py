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


class SDXLLightningProvider(
    ImageProvider
):
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
                "SDXL-Lightning is configured "
                "for CUDA, but CUDA is not "
                "available."
            )

        self.device = configured_device

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
                "Unsupported SDXL-Lightning "
                f"dtype: {configured_dtype}"
            )

        model_path = (
            os.getenv(
                "MNEMEONA_SDXL_LIGHTNING_MODEL"
            )
            or config.get(
                "model_path",
                "./models/SDXL-Lightning",
            )
        )

        self.model_path = (
            resolve_model_path(
                model_path
            )
        )

    @property
    def id(self) -> str:
        return "sdxl_lightning"

    @property
    def name(self) -> str:
        return "SDXL-Lightning 4-Step"

    @property
    def version(self) -> str:
        return "1.0.0"

    def settings_schema(
        self,
    ) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "steps": {
                    "type": "integer",
                    "title": "Steps",
                    "default": 4,
                    "minimum": 4,
                    "maximum": 4,
                },
                "guidance_scale": {
                    "type": "number",
                    "title": "Guidance Scale",
                    "default": 0.0,
                    "minimum": 0.0,
                    "maximum": 0.0,
                    "step": 1.0,
                },
                "negative_prompt": {
                    "type": "string",
                    "title": "Negative Prompt",
                    "default": "",
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
                "use_cpu_offload": {
                    "type": "boolean",
                    "title": "CPU Offload",
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
            "steps": 4,
            "guidance_scale": 0.0,
        }

    def _checkpoint_path(
        self,
    ) -> Path:
        checkpoint = (
            self.model_path
            / "sdxl_lightning_4step_unet.safetensors"
        )

        if checkpoint.exists():
            return checkpoint

        raise RuntimeError(
            "SDXL-Lightning 4-step checkpoint "
            "was not found.\n\n"
            f"Expected:\n{checkpoint}\n\n"
            "Run:\n"
            "  ./install_provider.sh "
            "sdxl_lightning"
        )

    def load(self) -> None:
        if self._pipeline is not None:
            return

        if not self.model_path.exists():
            raise RuntimeError(
                "SDXL-Lightning model directory "
                "was not found at "
                f"{self.model_path}\n\n"
                "Run:\n"
                "  ./install_provider.sh "
                "sdxl_lightning"
            )

        checkpoint = (
            self._checkpoint_path()
        )

        from diffusers import (
            EulerDiscreteScheduler,
            StableDiffusionXLPipeline,
            UNet2DConditionModel,
        )
        from huggingface_hub import (
            hf_hub_download,
        )
        from safetensors.torch import (
            load_file,
        )

        base_model = (
            "stabilityai/"
            "stable-diffusion-xl-base-1.0"
        )

        print(
            "Loading SDXL-Lightning 4-Step..."
        )

        print(
            "Loading SDXL base model..."
        )

        # Build the Lightning UNet from
        # the SDXL base UNet configuration.
        unet = (
            UNet2DConditionModel
            .from_config(
                base_model,
                subfolder="unet",
            )
        )

        print(
            "Loading Lightning UNet "
            f"from {checkpoint}..."
        )

        state_dict = load_file(
            str(checkpoint)
        )

        unet.load_state_dict(
            state_dict,
            strict=True,
        )

        del state_dict

        gc.collect()

        # Construct the SDXL pipeline with
        # the distilled Lightning UNet.
        pipe = (
            StableDiffusionXLPipeline
            .from_pretrained(
                base_model,
                unet=unet,
                torch_dtype=self.dtype,
                variant="fp16",
            )
        )

        # SDXL-Lightning specifically requires
        # trailing timestep spacing.
        pipe.scheduler = (
            EulerDiscreteScheduler
            .from_config(
                pipe.scheduler.config,
                timestep_spacing="trailing",
            )
        )

        if self.device == "cuda":
            use_cpu_offload = (
                self.settings.get(
                    "use_cpu_offload",
                    True,
                )
            )

            if use_cpu_offload:
                pipe.enable_model_cpu_offload()
            else:
                pipe.to("cuda")

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
            "SDXL-Lightning 4-Step loaded."
        )

    def unload(self) -> None:
        if self._pipeline is None:
            return

        try:
            self._pipeline.to("cpu")
        except Exception:
            pass

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

        if not (
            512
            <= request.width
            <= 1024
        ):
            raise ValueError(
                "Width must be between "
                "512 and 1024."
            )

        if not (
            512
            <= request.height
            <= 1024
        ):
            raise ValueError(
                "Height must be between "
                "512 and 1024."
            )

        # SDXL-Lightning must use exactly
        # the number of steps it was distilled
        # for.
        if request.steps != 4:
            raise ValueError(
                "SDXL-Lightning 4-Step must "
                "use exactly 4 inference steps."
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

        negative_prompt = str(
            settings.get(
                "negative_prompt",
                "",
            )
        )

        # SDXL-Lightning uses CFG 0.
        # Keep this fixed rather than allowing
        # normal SDXL CFG values.
        guidance_scale = 0.0

        pipeline_kwargs = {
            "prompt": request.prompt,
            "height": request.height,
            "width": request.width,
            "num_inference_steps": 4,
            "guidance_scale": (
                guidance_scale
            ),
            "generator": generator,
        }

        # A negative prompt has no practical
        # effect with CFG 0, so don't feed one
        # into the pipeline.
        if negative_prompt:
            pipeline_kwargs[
                "negative_prompt"
            ] = negative_prompt

        print(
            "Generating with SDXL-Lightning "
            "4-Step:"
        )

        print(
            f"  resolution: "
            f"{request.width}x"
            f"{request.height}"
        )

        print(
            "  steps: 4"
        )

        print(
            "  guidance: 0"
        )

        result = self._pipeline(
            **pipeline_kwargs
        )

        return GenerationResult(
            image=result.images[0],
            seed=seed,
            provider=self.id,
            metadata={
                "model": self.name,
                "settings": settings,
                "steps": 4,
                "guidance_scale": 0.0,
            },
        )
