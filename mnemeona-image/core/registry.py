from __future__ import annotations

import gc
import importlib
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

import torch

from providers.base import ImageProvider


class ProviderRegistry:
    """
    Manifest-driven image provider registry.

    A provider is considered available only when:

    1. Its manifest.json exists.
    2. Its provider module exists.
    3. For local-diffusers providers, the configured model_path
       exists on disk.

    Mnemeona keeps provider instances lightweight while ensuring
    that at most ONE heavyweight image-generation pipeline is
    resident in VRAM at a time.

    Providers may optionally implement:

        load()
        unload()

    Generation itself remains provider-specific.
    """

    def __init__(
        self,
        config: dict[str, Any],
    ) -> None:
        self.config = config

        #
        # mnemeona-image/
        #
        self.project_dir = (
            Path(__file__)
            .resolve()
            .parents[1]
        )

        #
        # mnemeona-image/providers/
        #
        self.providers_dir = (
            self.project_dir / "providers"
        )

        self._manifests: dict[
            str,
            dict[str, Any],
        ] = {}

        self._instances: dict[
            str,
            ImageProvider,
        ] = {}

        self._loaded_provider_id: str | None = None

        self._discover_manifests()

        configured_active = config.get(
            "active_provider",
            "",
        )

        if (
            configured_active
            and configured_active in self._manifests
        ):
            self.active_id = configured_active

        else:
            self.active_id = (
                self._first_enabled_provider()
            )

            if self.active_id is not None:
                self.config[
                    "active_provider"
                ] = self.active_id

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------

    def _discover_manifests(self) -> None:
        """
        Discover provider manifests.

        IMPORTANT:
        A manifest by itself is NOT enough to make a provider
        available.

        For local-diffusers providers we also verify that the
        configured model_path exists.

        This means deleting:

            models/DreamShaper_XL

        automatically removes DreamShaper XL from the provider
        list without requiring the user to manually disable it.
        """

        discovered: dict[
            str,
            dict[str, Any],
        ] = {}

        if not self.providers_dir.exists():
            self._manifests.clear()
            return

        for manifest_path in sorted(
            self.providers_dir.glob(
                "*/manifest.json"
            )
        ):
            try:
                with manifest_path.open(
                    "r",
                    encoding="utf-8",
                ) as handle:
                    manifest = json.load(
                        handle
                    )

                if not isinstance(
                    manifest,
                    dict,
                ):
                    print(
                        "WARNING: Ignoring invalid "
                        f"provider manifest: "
                        f"{manifest_path}"
                    )
                    continue

                provider_id = manifest.get(
                    "id"
                )

                if not provider_id:
                    print(
                        "WARNING: Provider manifest "
                        f"has no id: "
                        f"{manifest_path}"
                    )
                    continue

                provider_id = str(
                    provider_id
                )

                manifest[
                    "_directory"
                ] = str(
                    manifest_path.parent
                )

                manifest[
                    "_manifest_path"
                ] = str(
                    manifest_path
                )

                #
                # Make sure the provider module actually exists.
                #

                module_spec = manifest.get(
                    "module"
                )

                if (
                    module_spec
                    and ":" in str(module_spec)
                ):
                    module_name = str(
                        module_spec
                    ).split(
                        ":",
                        1,
                    )[0]

                    provider_file = (
                        manifest_path.parent
                        / f"{module_name}.py"
                    )

                    if not provider_file.exists():
                        print(
                            "WARNING: Skipping provider "
                            f"{provider_id}: provider module "
                            f"does not exist: "
                            f"{provider_file}"
                        )
                        continue

                #
                # IMPORTANT:
                #
                # Check whether the actual model exists.
                #

                model_available = (
                    self._manifest_model_exists(
                        manifest
                    )
                )

                if not model_available:
                    print(
                        "Provider unavailable "
                        f"(model missing): "
                        f"{provider_id}"
                    )

                    continue

                discovered[
                    provider_id
                ] = manifest

            except Exception as exc:
                print(
                    "WARNING: Failed to load provider "
                    f"manifest {manifest_path}: "
                    f"{exc}"
                )

        #
        # If a provider disappeared since the previous discovery,
        # remove its cached instance.
        #

        previous_ids = set(
            self._manifests.keys()
        )

        discovered_ids = set(
            discovered.keys()
        )

        removed_ids = (
            previous_ids - discovered_ids
        )

        for provider_id in removed_ids:
            #
            # Do not allow a removed provider to remain loaded.
            #

            if (
                self._loaded_provider_id
                == provider_id
            ):
                try:
                    self.unload(
                        provider_id
                    )
                except Exception:
                    self._loaded_provider_id = None

            #
            # Drop the lightweight provider instance too.
            #

            self._instances.pop(
                provider_id,
                None,
            )

        self._manifests = discovered

        #
        # Make sure active_id still points to an available provider.
        #

        if (
            getattr(
                self,
                "active_id",
                None,
            )
            not in self._manifests
        ):
            next_provider = (
                self._first_enabled_provider()
            )

            self.active_id = next_provider

            self.config[
                "active_provider"
            ] = next_provider or ""

    def _manifest_model_exists(
        self,
        manifest: dict[str, Any],
    ) -> bool:
        """
        Determine whether the actual model referenced by a
        provider manifest exists.

        For non-local providers we don't require a local model
        directory.

        For local-diffusers providers, model_path is required
        and must exist.

        Relative model paths are resolved against the
        mnemeona-image project directory first.

        Example:

            models/DreamShaper_XL

        becomes:

            /home/yl/mnemeona/mnemeona-image/models/DreamShaper_XL
        """

        provider_type = str(
            manifest.get(
                "type",
                "",
            )
        ).lower()

        #
        # Only local model providers need a filesystem model check.
        #

        if provider_type != "local-diffusers":
            return True

        model_path_value = (
            manifest.get(
                "model_path"
            )
        )

        #
        # Support a few alternative manifest layouts so provider
        # manifests remain flexible.
        #

        if not model_path_value:
            model_path_value = (
                manifest.get(
                    "model_dir"
                )
            )

        if not model_path_value:
            model_path_value = (
                manifest.get(
                    "path"
                )
            )

        #
        # Some manifests may define:
        #
        # "model": {
        #     "path": "models/Foo"
        # }
        #

        if not model_path_value:
            model_value = manifest.get(
                "model"
            )

            if isinstance(
                model_value,
                dict,
            ):
                model_path_value = (
                    model_value.get(
                        "path"
                    )
                    or model_value.get(
                        "model_path"
                    )
                    or model_value.get(
                        "directory"
                    )
                )

        #
        # A local-diffusers provider without a model path cannot
        # be considered installed.
        #

        if not model_path_value:
            print(
                "WARNING: Local image provider "
                f"{manifest.get('id', '<unknown>')} "
                "does not define model_path."
            )

            return False

        try:
            model_path = Path(
                str(
                    model_path_value
                )
            ).expanduser()

            #
            # Absolute path:
            #
            # /home/yl/mnemeona/mnemeona-image/models/Foo
            #

            if model_path.is_absolute():
                resolved_path = model_path

            else:
                #
                # Normal project-relative path:
                #
                # models/Foo
                #
                project_relative = (
                    self.project_dir
                    / model_path
                )

                #
                # Also support provider-relative paths as a fallback.
                #

                provider_relative = (
                    Path(
                        manifest[
                            "_directory"
                        ]
                    )
                    / model_path
                )

                if project_relative.exists():
                    resolved_path = (
                        project_relative
                    )

                else:
                    resolved_path = (
                        provider_relative
                    )

            exists = (
                resolved_path.exists()
            )

            if not exists:
                print(
                    "Model not found for provider "
                    f"{manifest.get('id', '<unknown>')}: "
                    f"{resolved_path}"
                )

            return exists

        except Exception as exc:
            print(
                "WARNING: Could not check model path "
                f"for provider "
                f"{manifest.get('id', '<unknown>')}: "
                f"{exc}"
            )

            return False

    def _refresh_discovery(self) -> None:
        """
        Re-scan manifests and model directories.

        This is intentionally cheap because it only checks manifests,
        provider modules, and filesystem paths. It does NOT load
        image-generation pipelines.
        """

        self._discover_manifests()

    def _first_enabled_provider(
        self,
    ) -> str | None:
        provider_config = self.config.get(
            "providers",
            {},
        )

        for provider_id in sorted(
            self._manifests.keys()
        ):
            settings = provider_config.get(
                provider_id,
                {},
            )

            if settings.get(
                "enabled",
                True,
            ):
                return provider_id

        return None

    # ------------------------------------------------------------------
    # Provider construction
    # ------------------------------------------------------------------

    def _provider_config(
        self,
        provider_id: str,
    ) -> dict[str, Any]:
        providers = self.config.setdefault(
            "providers",
            {},
        )

        return dict(
            providers.get(
                provider_id,
                {},
            )
        )

    def _load_provider_class(
        self,
        provider_id: str,
    ) -> type[ImageProvider]:
        manifest = self._manifests.get(
            provider_id
        )

        if manifest is None:
            raise RuntimeError(
                f"Unknown image provider: "
                f"{provider_id}"
            )

        module_spec = manifest.get(
            "module"
        )

        if not module_spec:
            raise RuntimeError(
                f"Provider {provider_id} "
                "does not define a module."
            )

        if ":" not in module_spec:
            raise RuntimeError(
                f"Invalid module declaration "
                f"for provider {provider_id}: "
                f"{module_spec}"
            )

        module_name, class_name = (
            module_spec.split(
                ":",
                1,
            )
        )

        provider_dir = Path(
            manifest["_directory"]
        )

        provider_file = (
            provider_dir
            / f"{module_name}.py"
        )

        if not provider_file.exists():
            raise RuntimeError(
                f"Provider module does not exist: "
                f"{provider_file}"
            )

        #
        # Every provider gets a unique Python module name.
        #
        # We cannot simply import "provider" because LCM,
        # Vega, and other providers all have their own
        # provider.py.
        #

        unique_module_name = (
            f"mnemeona_provider_"
            f"{provider_id.replace('-', '_')}"
        )

        spec = (
            importlib.util.spec_from_file_location(
                unique_module_name,
                provider_file,
            )
        )

        if (
            spec is None
            or spec.loader is None
        ):
            raise RuntimeError(
                f"Unable to create module spec "
                f"for provider {provider_id}: "
                f"{provider_file}"
            )

        module = (
            importlib.util.module_from_spec(
                spec
            )
        )

        #
        # Register the unique module name BEFORE
        # executing the module.
        #

        sys.modules[
            unique_module_name
        ] = module

        try:
            spec.loader.exec_module(
                module
            )

        except Exception:
            sys.modules.pop(
                unique_module_name,
                None,
            )
            raise

        try:
            provider_class = getattr(
                module,
                class_name,
            )

        except AttributeError as exc:
            raise RuntimeError(
                f"Provider module "
                f"{provider_file} does not define "
                f"{class_name}"
            ) from exc

        if not issubclass(
            provider_class,
            ImageProvider,
        ):
            raise RuntimeError(
                f"Provider class "
                f"{class_name} from "
                f"{provider_file} does not inherit "
                "from ImageProvider."
            )

        return provider_class

    def _create_provider(
        self,
        provider_id: str,
    ) -> ImageProvider:
        provider_class = (
            self._load_provider_class(
                provider_id
            )
        )

        config = self._provider_config(
            provider_id
        )

        return provider_class(
            config
        )

    # ------------------------------------------------------------------
    # Provider access
    # ------------------------------------------------------------------

    def get(
        self,
        provider_id: str,
    ) -> ImageProvider:
        #
        # Re-check discovery before accessing a provider.
        # This catches models deleted while the service is running.
        #

        self._refresh_discovery()

        if provider_id not in self._manifests:
            raise RuntimeError(
                f"Unknown or unavailable image provider: "
                f"{provider_id}"
            )

        if provider_id not in self._instances:
            self._instances[
                provider_id
            ] = self._create_provider(
                provider_id
            )

        return self._instances[
            provider_id
        ]

    # ------------------------------------------------------------------
    # Provider loading
    # ------------------------------------------------------------------

    def _load_instance(
        self,
        provider_id: str,
    ) -> ImageProvider:
        provider = self.get(
            provider_id
        )

        load_method = getattr(
            provider,
            "load",
            None,
        )

        if callable(load_method):
            load_method()

        self._loaded_provider_id = (
            provider_id
        )

        return provider

    def ensure_only_loaded(
        self,
        provider_id: str,
    ) -> ImageProvider:
        """
        Ensure the requested provider is the only provider
        with a heavyweight pipeline loaded.

        Switching always unloads the previous provider BEFORE
        the new provider is loaded.
        """

        self._refresh_discovery()

        if provider_id not in self._manifests:
            raise RuntimeError(
                f"Unknown or unavailable image provider: "
                f"{provider_id}"
            )

        #
        # If another provider is active, completely release it.
        #

        if (
            self._loaded_provider_id
            != provider_id
        ):
            self.unload_all()

        #
        # If this provider is already loaded, don't reload it.
        #

        if (
            self._loaded_provider_id
            == provider_id
        ):
            return self.get(
                provider_id
            )

        #
        # Load only this provider.
        #

        try:
            return self._load_instance(
                provider_id
            )

        except Exception:
            self._loaded_provider_id = None

            try:
                provider = self._instances.get(
                    provider_id
                )

                if provider is not None:
                    unload = getattr(
                        provider,
                        "unload",
                        None,
                    )

                    if callable(unload):
                        unload()

            except Exception:
                pass

            self._cleanup_cuda()

            raise

    # ------------------------------------------------------------------
    # Switching
    # ------------------------------------------------------------------

    def switch(
        self,
        provider_id: str,
    ) -> dict[str, Any]:
        """
        Change the active provider.

        Switching does NOT load the new model.

        The new model is loaded on the first generation request.
        """

        self._refresh_discovery()

        if provider_id not in self._manifests:
            raise RuntimeError(
                f"Unknown or unavailable image provider: "
                f"{provider_id}"
            )

        provider_config = self.config.setdefault(
            "providers",
            {},
        ).setdefault(
            provider_id,
            {},
        )

        if not provider_config.get(
            "enabled",
            True,
        ):
            raise RuntimeError(
                f"Image provider "
                f"'{provider_id}' is disabled."
            )

        previous_id = self.active_id

        print()
        print(
            "=========================================="
        )
        print(
            " Switching image provider"
        )
        print(
            "=========================================="
        )
        print(
            f"Previous active provider: "
            f"{previous_id}"
        )
        print(
            f"New active provider: "
            f"{provider_id}"
        )
        print()

        #
        # HARD VRAM BOUNDARY.
        #
        # Unload BEFORE changing the active provider.
        #

        self.unload_all()

        self.active_id = provider_id

        self.config[
            "active_provider"
        ] = provider_id

        return {
            "ok": True,
            "provider": provider_id,
            "previous_provider": previous_id,
            "loaded_provider": (
                self._loaded_provider_id
            ),
            "message": (
                f"Active provider switched to "
                f"{provider_id}. "
                "The model will load on first generation."
            ),
        }

    # ------------------------------------------------------------------
    # Unloading
    # ------------------------------------------------------------------

    def unload(
        self,
        provider_id: str,
    ) -> None:
        provider = self._instances.get(
            provider_id
        )

        if provider is None:
            if (
                self._loaded_provider_id
                == provider_id
            ):
                self._loaded_provider_id = None

            return

        print(
            f"Unloading image provider: "
            f"{provider_id}"
        )

        try:
            unload = getattr(
                provider,
                "unload",
                None,
            )

            if callable(unload):
                unload()

        finally:
            if (
                self._loaded_provider_id
                == provider_id
            ):
                self._loaded_provider_id = None

            self._cleanup_cuda()

        self._print_vram_status(
            "After provider unload"
        )

    def unload_all(self) -> None:
        """
        Release every provider pipeline.

        Provider objects remain registered so configuration and
        discovery are preserved, but heavyweight model objects
        are released.
        """

        loaded_id = (
            self._loaded_provider_id
        )

        #
        # First unload the provider the registry knows about.
        #

        if loaded_id is not None:
            provider = self._instances.get(
                loaded_id
            )

            if provider is not None:
                try:
                    unload = getattr(
                        provider,
                        "unload",
                        None,
                    )

                    if callable(unload):
                        print(
                            f"Unloading active image "
                            f"provider: {loaded_id}"
                        )
                        unload()

                except Exception as exc:
                    print(
                        "WARNING: Failed to unload "
                        f"{loaded_id}: {exc}"
                    )

        #
        # Also unload every other instantiated provider.
        #

        for provider_id, provider in list(
            self._instances.items()
        ):
            if provider_id == loaded_id:
                continue

            try:
                unload = getattr(
                    provider,
                    "unload",
                    None,
                )

                if callable(unload):
                    unload()

            except Exception as exc:
                print(
                    "WARNING: Failed to unload "
                    f"{provider_id}: {exc}"
                )

        self._loaded_provider_id = None

        self._cleanup_cuda()

        self._print_vram_status(
            "After unload_all"
        )

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------

    @property
    def loaded_provider_id(
        self,
    ) -> str | None:
        return self._loaded_provider_id

    def get_provider_status(
        self,
        provider_id: str,
    ) -> dict[str, Any]:
        self._refresh_discovery()

        if provider_id not in self._manifests:
            raise RuntimeError(
                f"Unknown or unavailable image provider: "
                f"{provider_id}"
            )

        provider = self.get(
            provider_id
        )

        status = dict(
            provider.status()
        )

        status.update(
            {
                "id": provider_id,
                "name": self._manifests[
                    provider_id
                ].get(
                    "name",
                    provider.name,
                ),
                "version": self._manifests[
                    provider_id
                ].get(
                    "version",
                    provider.version,
                ),
                "active": (
                    provider_id
                    == self.active_id
                ),
                "loaded": (
                    provider_id
                    == self._loaded_provider_id
                ),
                "model_exists": (
                    self._manifest_model_exists(
                        self._manifests[
                            provider_id
                        ]
                    )
                ),
            }
        )

        return status

    def get_settings_schema(
        self,
        provider_id: str,
    ) -> dict[str, Any]:
        self._refresh_discovery()

        provider = self.get(
            provider_id
        )

        return provider.settings_schema()

    def get_status(
        self,
    ) -> dict[str, Any]:
        """
        Return only providers that are actually available.

        This performs a lightweight filesystem discovery on every
        status request, so the frontend automatically stops showing
        providers whose local model directory has been removed.
        """

        self._refresh_discovery()

        providers: list[
            dict[str, Any]
        ] = []

        for provider_id in sorted(
            self._manifests.keys()
        ):
            manifest = self._manifests[
                provider_id
            ]

            provider_config = (
                self.config
                .get(
                    "providers",
                    {},
                )
                .get(
                    provider_id,
                    {},
                )
            )

            try:
                provider = self.get(
                    provider_id
                )

                provider_status = (
                    provider.status()
                )

            except Exception as exc:
                provider_status = {
                    "error": str(exc),
                    "loaded": False,
                }

            #
            # Only providers whose actual model exists reach here.
            #

            model_exists = (
                self._manifest_model_exists(
                    manifest
                )
            )

            if not model_exists:
                continue

            providers.append(
                {
                    "id": provider_id,
                    "name": manifest.get(
                        "name",
                        provider_id,
                    ),
                    "version": manifest.get(
                        "version",
                        "1.0.0",
                    ),
                    "type": manifest.get(
                        "type",
                        "unknown",
                    ),
                    "enabled": provider_config.get(
                        "enabled",
                        True,
                    ),
                    "active": (
                        provider_id
                        == self.active_id
                    ),
                    "loaded": (
                        provider_id
                        == self._loaded_provider_id
                    ),
                    "installed": True,
                    "status": {
                        **provider_status,
                        "model_exists": True,
                    },
                }
            )

        #
        # If the active provider disappeared because its model was
        # deleted, choose another available provider.
        #

        available_ids = {
            provider["id"]
            for provider in providers
        }

        if (
            self.active_id
            not in available_ids
        ):
            next_provider = (
                self._first_enabled_provider()
            )

            self.active_id = next_provider

            self.config[
                "active_provider"
            ] = next_provider or ""

            #
            # Recalculate active flags after changing active_id.
            #

            for provider in providers:
                provider["active"] = (
                    provider["id"]
                    == self.active_id
                )

        return {
            "active_provider": self.active_id,
            "loaded_provider": (
                self._loaded_provider_id
            ),
            "providers": providers,
            "cuda": self._cuda_status(),
        }

    # ------------------------------------------------------------------
    # CUDA cleanup
    # ------------------------------------------------------------------

    @staticmethod
    def _cleanup_cuda() -> None:
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

    @staticmethod
    def _cuda_status() -> dict[str, Any]:
        if not torch.cuda.is_available():
            return {
                "available": False
            }

        try:
            device = (
                torch.cuda.current_device()
            )

            name = (
                torch.cuda.get_device_name(
                    device
                )
            )

            free, total = (
                torch.cuda.mem_get_info(
                    device
                )
            )

            allocated = (
                torch.cuda.memory_allocated(
                    device
                )
            )

            reserved = (
                torch.cuda.memory_reserved(
                    device
                )
            )

            return {
                "available": True,
                "device": device,
                "name": name,
                "total_gb": round(
                    total / 1024**3,
                    2,
                ),
                "free_gb": round(
                    free / 1024**3,
                    2,
                ),
                "used_gb": round(
                    (total - free)
                    / 1024**3,
                    2,
                ),
                "allocated_gb": round(
                    allocated / 1024**3,
                    2,
                ),
                "reserved_gb": round(
                    reserved / 1024**3,
                    2,
                ),
            }

        except Exception as exc:
            return {
                "available": True,
                "error": str(exc),
            }

    @classmethod
    def _print_vram_status(
        cls,
        prefix: str,
    ) -> None:
        status = cls._cuda_status()

        if not status.get(
            "available",
            False,
        ):
            return

        if "error" in status:
            print(
                f"{prefix}: "
                f"{status['error']}"
            )
            return

        print(
            f"{prefix}: "
            f"{status['free_gb']} GB free / "
            f"{status['total_gb']} GB total VRAM "
            f"(allocated "
            f"{status['allocated_gb']} GB, "
            f"reserved "
            f"{status['reserved_gb']} GB)"
        )
