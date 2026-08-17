from __future__ import annotations

import copy
import json
import os
from pathlib import Path
from typing import Any


ROOT = Path(
    __file__
).resolve().parents[1]


DEFAULT_CONFIG: dict[str, Any] = {
    "active_provider": "lcm",

    "providers": {
        "lcm": {
            "enabled": True,

            "model_path": (
                "./models/LCM_Dreamshaper_v7"
            ),

            "device": "auto",
            "dtype": "float16",

            "settings": {
                "guidance_scale": 8.0,
                "lcm_origin_steps": 50,
                "attention_slicing": True,
                "vae_slicing": True,
                "vae_tiling": True,
            },
        },

        "sdxl_lightning": {
            "enabled": True,

            "model_path": (
                "./models/SDXL-Lightning"
            ),

            "device": "auto",
            "dtype": "float16",

            "settings": {
                "guidance_scale": 0.0,
                "attention_slicing": True,
                "vae_slicing": True,
                "vae_tiling": True
            }
        },

        # These providers can be installed later.
        #
        # Keeping them disabled until their provider
        # packages/checkpoints are installed prevents
        # Mnemeona from trying to load them prematurely.

        "sdxl_hyper": {
            "enabled": False,

            "model_path": (
                "./models/SDXL-Hyper"
            ),

            "device": "auto",
            "dtype": "float16",

            "settings": {
                "guidance_scale": 0.0,
                "attention_slicing": True,
                "vae_slicing": True,
                "vae_tiling": True,
            },
        },

        "flux_schnell": {
            "enabled": False,

            "model_path": (
                "./models/FLUX.1-schnell"
            ),

            "device": "auto",
            "dtype": "float16",

            "settings": {
                "enable_cpu_offload": True,
                "enable_vae_tiling": True,
            },
        },

        "sd35_medium": {
            "enabled": False,

            "model_path": (
                "./models/stable-diffusion-3.5-medium"
            ),

            "device": "auto",
            "dtype": "float16",

            "settings": {
                "enable_cpu_offload": True,
            },
        },
    },

    "gpu_coordination": {
        "enabled": True,
        "ollama_url": (
            "http://127.0.0.1:11434"
        ),
        "reload_after_image": True,
        "timeout_seconds": 10,
    },
}


def config_path() -> Path:
    configured = os.getenv(
        "MNEMEONA_IMAGE_CONFIG"
    )

    if configured:
        return (
            Path(configured)
            .expanduser()
            .resolve()
        )

    return (
        ROOT
        / "config"
        / "image-ai.json"
    )


def _merge(
    base: dict[str, Any],
    override: dict[str, Any],
) -> dict[str, Any]:
    result = copy.deepcopy(base)

    for key, value in override.items():
        if (
            isinstance(value, dict)
            and isinstance(
                result.get(key),
                dict,
            )
        ):
            result[key] = _merge(
                result[key],
                value,
            )
        else:
            result[key] = value

    return result


def load_config() -> dict[str, Any]:
    path = config_path()

    if not path.exists():
        return copy.deepcopy(
            DEFAULT_CONFIG
        )

    try:
        with path.open(
            "r",
            encoding="utf-8",
        ) as handle:
            user_config = json.load(
                handle
            )

    except json.JSONDecodeError as exc:
        raise RuntimeError(
            "Invalid image AI configuration "
            f"at {path}: {exc}"
        ) from exc

    if not isinstance(
        user_config,
        dict,
    ):
        raise RuntimeError(
            "Image AI configuration at "
            f"{path} must contain "
            "a JSON object."
        )

    config = _merge(
        DEFAULT_CONFIG,
        user_config,
    )

    # Environment variables intentionally
    # override configuration files.

    lcm_model = os.getenv(
        "MNEMEONA_LCM_MODEL"
    )

    if lcm_model:
        config.setdefault(
            "providers",
            {},
        ).setdefault(
            "lcm",
            {},
        )["model_path"] = lcm_model

    return config


def save_config(
    config: dict[str, Any],
) -> None:
    path = config_path()

    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with path.open(
        "w",
        encoding="utf-8",
    ) as handle:
        json.dump(
            config,
            handle,
            indent=2,
        )

        handle.write("\n")


def resolve_model_path(
    configured_path: str,
) -> Path:
    """
    Resolve model paths consistently.

    Absolute paths are used unchanged.

    Relative paths are relative to the
    mnemeona-image directory, NOT the
    shell's current working directory.
    """

    path = Path(
        os.path.expandvars(
            os.path.expanduser(
                configured_path
            )
        )
    )

    if path.is_absolute():
        return path.resolve()

    return (
        ROOT / path
    ).resolve()
