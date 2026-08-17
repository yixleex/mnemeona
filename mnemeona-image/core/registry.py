from __future__ import annotations

import importlib
import json
from pathlib import Path
from typing import Any

from providers.base import ImageProvider


ROOT = Path(
    __file__
).resolve().parents[1]

PROVIDERS_DIR = (
    ROOT / "providers"
)


class ProviderRegistry:
    def __init__(
        self,
        config: dict[str, Any],
    ) -> None:
        self.config = config

        self._manifests: dict[
            str,
            dict[str, Any],
        ] = {}

        self._instances: dict[
            str,
            ImageProvider,
        ] = {}

        self.discover()

    def discover(self) -> None:
        self._manifests.clear()

        if not PROVIDERS_DIR.exists():
            return

        for manifest_path in sorted(
            PROVIDERS_DIR.glob(
                "*/manifest.json"
            )
        ):
            try:
                manifest = json.loads(
                    manifest_path.read_text(
                        encoding="utf-8"
                    )
                )

                if not isinstance(
                    manifest,
                    dict,
                ):
                    raise ValueError(
                        "Manifest must be a JSON object."
                    )

                provider_id = (
                    manifest.get("id")
                    or manifest_path.parent.name
                )

                if not isinstance(
                    provider_id,
                    str,
                ):
                    raise ValueError(
                        "Provider id must be a string."
                    )

                manifest["_path"] = str(
                    manifest_path
                )

                self._manifests[
                    provider_id
                ] = manifest

            except (
                OSError,
                ValueError,
            ) as exc:
                print(
                    "Skipping invalid provider "
                    f"manifest {manifest_path}: {exc}"
                )

    @property
    def active_id(self) -> str:
        return str(
            self.config.get(
                "active_provider",
                "",
            )
        )

    def manifests(
        self,
    ) -> list[dict[str, Any]]:
        active = self.active_id

        output: list[
            dict[str, Any]
        ] = []

        providers_config = self.config.get(
            "providers",
            {},
        )

        for (
            provider_id,
            manifest,
        ) in sorted(
            self._manifests.items()
        ):
            provider_config = (
                providers_config.get(
                    provider_id,
                    {},
                )
            )

            output.append(
                {
                    "id": provider_id,
                    "name": manifest.get(
                        "name",
                        provider_id,
                    ),
                    "version": manifest.get(
                        "version",
                    ),
                    "type": manifest.get(
                        "type",
                        "local",
                    ),
                    "enabled": provider_config.get(
                        "enabled",
                        True,
                    ),
                    "installed": True,
                    "active": (
                        provider_id == active
                    ),
                }
            )

        return output

    def _load_class(
        self,
        provider_id: str,
    ):
        manifest = self._manifests[
            provider_id
        ]

        target = manifest.get(
            "module"
        )

        if not target:
            raise RuntimeError(
                f"Provider '{provider_id}' "
                "does not specify a module."
            )

        if ":" not in target:
            raise RuntimeError(
                f"Provider '{provider_id}' "
                f"has invalid module target: {target}"
            )

        module_name, class_name = (
            target.split(":", 1)
        )

        module = importlib.import_module(
            f"providers."
            f"{provider_id}."
            f"{module_name}"
        )

        return getattr(
            module,
            class_name,
        )

    def _provider_config(
        self,
        provider_id: str,
    ) -> dict[str, Any]:
        return (
            self.config
            .get("providers", {})
            .get(provider_id, {})
        )

    def get(
        self,
        provider_id: str,
    ) -> ImageProvider:
        if provider_id not in self._manifests:
            available = ", ".join(
                sorted(
                    self._manifests
                )
            )

            raise RuntimeError(
                f"Image provider "
                f"'{provider_id}' "
                "is not installed. "
                f"Available providers: "
                f"{available or 'none'}"
            )

        provider_config = (
            self._provider_config(
                provider_id
            )
        )

        if not provider_config.get(
            "enabled",
            True,
        ):
            raise RuntimeError(
                f"Image provider "
                f"'{provider_id}' "
                "is disabled."
            )

        if provider_id not in (
            self._instances
        ):
            cls = self._load_class(
                provider_id
            )

            self._instances[
                provider_id
            ] = cls(
                provider_config
            )

        return self._instances[
            provider_id
        ]

    def get_active(
        self,
    ) -> ImageProvider:
        provider_id = self.active_id

        if not provider_id:
            raise RuntimeError(
                "No active image provider "
                "is configured."
            )

        return self.get(
            provider_id
        )

    def get_status(
        self,
    ) -> dict[str, Any]:
        active_id = self.active_id

        active_status = None

        if active_id in self._manifests:
            try:
                active_status = (
                    self.get_active()
                    .status()
                )
            except Exception as exc:
                active_status = {
                    "error": str(exc)
                }

        return {
            "active_provider": active_id,
            "providers": self.manifests(),
            "active_status": active_status,
        }

    def get_provider_status(
        self,
        provider_id: str,
    ) -> dict[str, Any]:
        provider = self.get(
            provider_id
        )

        return provider.status()

    def get_settings_schema(
        self,
        provider_id: str,
    ) -> dict[str, Any]:
        provider = self.get(
            provider_id
        )

        return provider.settings_schema()

    def unload_all(self) -> None:
        for provider in list(
            self._instances.values()
        ):
            try:
                provider.unload()
            except Exception as exc:
                print(
                    "Provider unload failed: "
                    f"{exc}"
                )

        self._instances.clear()
