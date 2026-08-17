from __future__ import annotations

import gc
import importlib
import json
from pathlib import Path
from typing import Any

import torch

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

        self._loaded_provider_id: str | None = None

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

    @property
    def loaded_provider_id(
        self,
    ) -> str | None:
        return self._loaded_provider_id

    def manifests(
        self,
    ) -> list[dict[str, Any]]:
        active = self.active_id
        loaded = self._loaded_provider_id

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
                    "loaded": (
                        provider_id == loaded
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

    def ensure_only_loaded(
        self,
        provider_id: str,
    ) -> ImageProvider:
        """
        Ensure that ONLY the requested provider
        is loaded.

        This is the central VRAM safety mechanism.

        If another provider is loaded, it is fully
        unloaded before the requested provider is
        loaded.
        """

        if provider_id not in self._manifests:
            raise RuntimeError(
                f"Unknown image provider: "
                f"{provider_id}"
            )

        if (
            self._loaded_provider_id
            == provider_id
        ):
            return self.get(
                provider_id
            )

        self.unload_all()

        provider = self.get(
            provider_id
        )

        self._loaded_provider_id = (
            provider_id
        )

        return provider

    def switch(
        self,
        provider_id: str,
    ) -> dict[str, Any]:
        """
        Switch the active image provider.

        The current provider is unloaded BEFORE
        the new provider becomes active.

        The new provider is intentionally not
        loaded here. It will be lazy-loaded on
        first generation.
        """

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

        old_provider = (
            self._loaded_provider_id
        )

        if old_provider != provider_id:
            self.unload_all()

        self.config[
            "active_provider"
        ] = provider_id

        return {
            "ok": True,
            "active_provider": provider_id,
            "previous_provider": old_provider,
            "loaded_provider": (
                self._loaded_provider_id
            ),
            "message": (
                f"Switched image provider "
                f"from "
                f"{old_provider or 'none'} "
                f"to {provider_id}. "
                "The new model will be loaded "
                "when it is first used."
            ),
        }

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
            "loaded_provider": (
                self._loaded_provider_id
            ),
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
        """
        Fully unload every instantiated image
        provider.

        This deliberately clears provider instances
        as well as calling their unload methods.

        CUDA cleanup is performed after every provider
        has been released.
        """

        for (
            provider_id,
            provider,
        ) in list(
            self._instances.items()
        ):
            try:
                print(
                    f"Unloading image provider "
                    f"{provider_id}..."
                )

                provider.unload()

            except Exception as exc:
                print(
                    "Provider unload failed "
                    f"for {provider_id}: {exc}"
                )

        self._instances.clear()

        self._loaded_provider_id = None

        # Release Python references.
        gc.collect()

        # Release PyTorch CUDA allocations.
        if torch.cuda.is_available():
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

        print(
            "All image providers unloaded "
            "and CUDA cache cleared."
        )
