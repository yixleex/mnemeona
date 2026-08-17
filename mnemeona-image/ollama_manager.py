from __future__ import annotations

import json
import os
from dataclasses import dataclass
from urllib.error import URLError, HTTPError
from urllib.request import Request, urlopen


@dataclass(frozen=True)
class OllamaConfig:
    enabled: bool
    base_url: str
    reload_after_image: bool
    timeout_seconds: float


class OllamaGPUManager:
    """
    Coordinates VRAM between Ollama and the Mnemeona image service.

    Before image generation:
      - inspect Ollama's currently loaded models
      - unload them with keep_alive=0

    After image generation:
      - optionally preload the models that were previously running

    Ollama itself is never stopped. Only the model is evicted from memory.
    """

    def __init__(self) -> None:
        self.config = OllamaConfig(
            enabled=os.getenv(
                "MNEMEONA_OLLAMA_GPU_COORDINATION",
                "true",
            ).strip().lower()
            not in {"0", "false", "no", "off"},
            base_url=os.getenv(
                "MNEMEONA_OLLAMA_URL",
                "http://127.0.0.1:11434",
            ).rstrip("/"),
            reload_after_image=os.getenv(
                "MNEMEONA_OLLAMA_RELOAD_AFTER_IMAGE",
                "true",
            ).strip().lower()
            not in {"0", "false", "no", "off"},
            timeout_seconds=float(
                os.getenv(
                    "MNEMEONA_OLLAMA_TIMEOUT",
                    "10",
                )
            ),
        )

        self._unloaded_models: list[str] = []

    @property
    def enabled(self) -> bool:
        return self.config.enabled

    def _request(
        self,
        method: str,
        path: str,
        payload: dict | None = None,
    ) -> dict:
        url = f"{self.config.base_url}{path}"

        data = (
            json.dumps(payload).encode("utf-8")
            if payload is not None
            else None
        )

        request = Request(
            url,
            data=data,
            method=method,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )

        with urlopen(
            request,
            timeout=self.config.timeout_seconds,
        ) as response:
            raw = response.read()

        if not raw:
            return {}

        return json.loads(raw.decode("utf-8"))

    def running_models(self) -> list[str]:
        if not self.enabled:
            return []

        try:
            data = self._request(
                "GET",
                "/api/ps",
            )
        except (URLError, HTTPError, OSError, ValueError) as exc:
            print(
                "Ollama GPU coordination: "
                f"could not query Ollama: {exc}"
            )
            return []

        models = data.get("models", [])

        names: list[str] = []

        for model in models:
            name = (
                model.get("name")
                or model.get("model")
            )

            if isinstance(name, str) and name:
                names.append(name)

        return names

    def unload_for_image_generation(self) -> list[str]:
        """
        Evict every currently loaded Ollama model.

        This intentionally does not stop the Ollama service.
        """
        self._unloaded_models = []

        if not self.enabled:
            return []

        models = self.running_models()

        if not models:
            return []

        print(
            "Ollama GPU coordination: "
            "unloading models before image generation: "
            + ", ".join(models)
        )

        for model in models:
            try:
                # Ollama documents keep_alive=0 as the API way
                # to unload a model immediately.
                self._request(
                    "POST",
                    "/api/generate",
                    {
                        "model": model,
                        "prompt": "",
                        "stream": False,
                        "keep_alive": 0,
                    },
                )

                self._unloaded_models.append(model)

            except (
                URLError,
                HTTPError,
                OSError,
                ValueError,
            ) as exc:
                print(
                    "Ollama GPU coordination: "
                    f"could not unload {model}: {exc}"
                )

        return list(self._unloaded_models)

    def restore_after_image_generation(self) -> list[str]:
        """
        Optionally preload the models that were running before
        image generation.

        This does not generate story content. It only warms the
        model back into Ollama memory.
        """
        models = list(self._unloaded_models)
        self._unloaded_models = []

        if not self.enabled:
            return []

        if not self.config.reload_after_image:
            return []

        restored: list[str] = []

        for model in models:
            try:
                # An empty API request preloads the model.
                self._request(
                    "POST",
                    "/api/generate",
                    {
                        "model": model,
                        "prompt": "",
                        "stream": False,
                    },
                )

                restored.append(model)

                print(
                    "Ollama GPU coordination: "
                    f"restored {model}"
                )

            except (
                URLError,
                HTTPError,
                OSError,
                ValueError,
            ) as exc:
                print(
                    "Ollama GPU coordination: "
                    f"could not restore {model}: {exc}"
                )

        return restored

    def status(self) -> dict:
        loaded = self.running_models()

        return {
            "enabled": self.enabled,
            "ollama_url": self.config.base_url,
            "reload_after_image": (
                self.config.reload_after_image
            ),
            "running_models": loaded,
            "unloaded_for_image": list(
                self._unloaded_models
            ),
        }
