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

        "sdxl_vega": {
            "enabled": True,

            "model_path": (
                "./models/Segmind-Vega"
            ),

            "device": "auto",
            "dtype": "float16",

            "settings": {
                "guidance_scale": 9.0,
                "negative_prompt": (
                    "worst quality, low quality, "
                    "blurry, distorted, deformed, "
                    "bad anatomy"
                ),
                "attention_slicing": True,
                "vae_slicing": True,
                "vae_tiling": True,
            },
        },

        "sdxl_dreamshaper": {
            "enabled": True,

            "model_path": (
                "./models/DreamShaper_XL"
            ),

            "device": "auto",
            "dtype": "float16",

            "settings": {
                "guidance_scale": 7.5,
                "negative_prompt": (
                    "text, letters, words, captions, "
                    "logo, watermark, signature, "
                    "worst quality, low quality, "
                    "blurry, distorted, deformed, "
                    "bad anatomy, bad proportions, "
                    "extra fingers, missing fingers, "
                    "extra limbs, malformed hands, "
                    "duplicate person"
                ),
                "attention_slicing": True,
                "vae_slicing": True,
                "vae_tiling": True,
            },
        },

        "ssd_1b": {
            "enabled": True,

            "model_path": (
                "./models/SSD-1B"
            ),

            "device": "auto",
            "dtype": "float16",

            "settings": {
                "guidance_scale": 9.0,
                "negative_prompt": (
                    "worst quality, low quality, "
                    "blurry, distorted, deformed, "
                    "bad anatomy, bad proportions, "
                    "extra fingers, missing fingers, "
                    "extra limbs, malformed hands"
                ),
                "attention_slicing": True,
                "vae_slicing": True,
                "vae_tiling": True,
                "use_cpu_offload": True,
            },
        },

        "animagine_xl": {
            "enabled": True,

            "model_path": (
                "./models/Animagine-XL-3.1"
            ),

            "device": "auto",
            "dtype": "float16",

            "settings": {
                "guidance_scale": 7.0,
                "negative_prompt": (
                    "lowres, bad anatomy, bad hands, "
                    "text, error, missing fingers, "
                    "extra digit, fewer digits, "
                    "cropped, worst quality, "
                    "low quality, normal quality, "
                    "jpeg artifacts, signature, "
                    "watermark, username, blurry"
                ),
                "attention_slicing": True,
                "vae_slicing": True,
                "vae_tiling": True,
                "use_cpu_offload": True,
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

    ssd_1b_model = os.getenv(
        "MNEMEONA_SSD_1B_MODEL"
    )

    if ssd_1b_model:
        config.setdefault(
            "providers",
            {},
        ).setdefault(
            "ssd_1b",
            {},
        )["model_path"] = ssd_1b_model

    animagine_xl_model = os.getenv(
        "MNEMEONA_ANIMAGINE_XL_MODEL"
    )

    if animagine_xl_model:
        config.setdefault(
            "providers",
            {},
        ).setdefault(
            "animagine_xl",
            {},
        )["model_path"] = animagine_xl_model

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
