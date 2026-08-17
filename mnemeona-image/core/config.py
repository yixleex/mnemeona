from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]


DEFAULT_CONFIG = {
    "active_provider": "lcm",
    "providers": {
        "lcm": {
            "enabled": True,
            "model_path": "./models/LCM_Dreamshaper_v7",
            "device": "auto",
            "dtype": "float16",
            "settings": {
                "guidance_scale": 8.0,
                "lcm_origin_steps": 50,
                "attention_slicing": True,
                "vae_slicing": True,
                "vae_tiling": True,
            },
        }
    },
    "gpu_coordination": {
        "enabled": True,
        "ollama_url": "http://127.0.0.1:11434",
        "reload_after_image": True,
        "timeout_seconds": 10,
    },
}


def config_path() -> Path:
    configured = os.getenv("MNEMEONA_IMAGE_CONFIG")
    if configured:
        return Path(configured).expanduser().resolve()

    return ROOT / "config" / "image-ai.json"


def _merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    result = dict(base)

    for key, value in override.items():
        if (
            isinstance(value, dict)
            and isinstance(result.get(key), dict)
        ):
            result[key] = _merge(result[key], value)
        else:
            result[key] = value

    return result


def load_config() -> dict[str, Any]:
    path = config_path()

    if not path.exists():
        return DEFAULT_CONFIG.copy()

    with path.open("r", encoding="utf-8") as handle:
        user_config = json.load(handle)

    return _merge(DEFAULT_CONFIG, user_config)


def save_config(config: dict[str, Any]) -> None:
    path = config_path()
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8") as handle:
        json.dump(config, handle, indent=2)
        handle.write("\n")
