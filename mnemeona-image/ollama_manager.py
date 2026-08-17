from __future__ import annotations

import json
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


@dataclass(frozen=True)
class OllamaConfig:
    enabled: bool
    base_url: str
    reload_after_image: bool
    timeout_seconds: float


class OllamaGPUManager:
    """
    Optional VRAM coordination layer.

    This is intentionally independent from image providers.
    """

    def __init__(self, config: dict | None = None) -> None:
        config = config or {}

        self.config = OllamaConfig(
            enabled=bool(config.get("enabled", True)),
            base_url=str(
                config.get(
                    "ollama_url",
                    "http://127.0.0.1:11434",
                )
            ).rstrip("/"),
            reload_after_image=bool(
                config.get("reload_after_image", True)
            ),
            timeout_seconds=float(
                config.get("timeout_seconds", 10)
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

        return (
            json.loads(raw.decode("utf-8"))
            if raw
            else {}
        )

    def running_models(self) -> list[str]:
        if not self.enabled:
            return []

        try:
            data = self._request("GET", "/api/ps")
        except (
            URLError,
            HTTPError,
            OSError,
            ValueError,
        ) as exc:
            print(
                f"Ollama GPU coordination query failed: {exc}"
            )
            return []

        names = []

        for model in data.get("models", []):
            name = (
                model.get("name")
                or model.get("model")
            )
            if isinstance(name, str) and name:
                names.append(name)

        return names

    def unload_for_image_generation(self) -> list[str]:
        self._unloaded_models = []

        if not self.enabled:
            return []

        models = self.running_models()

        for model in models:
            try:
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
                    f"Could not unload Ollama model "
                    f"{model}: {exc}"
                )

        return list(self._unloaded_models)

    def restore_after_image_generation(self) -> list[str]:
        models = list(self._unloaded_models)
        self._unloaded_models = []

        if (
            not self.enabled
            or not self.config.reload_after_image
        ):
            return []

        restored = []

        for model in models:
            try:
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
            except (
                URLError,
                HTTPError,
                OSError,
                ValueError,
            ) as exc:
                print(
                    f"Could not restore Ollama model "
                    f"{model}: {exc}"
                )

        return restored

    def status(self) -> dict:
        return {
            "enabled": self.enabled,
            "ollama_url": self.config.base_url,
            "reload_after_image": (
                self.config.reload_after_image
            ),
            "running_models": self.running_models(),
            "unloaded_for_image": list(
                self._unloaded_models
            ),
        }
