from __future__ import annotations

import gc
from typing import Any

import torch

from providers.base import ImageProvider


class ProviderRegistry:
    """
    Central registry and lifecycle manager for image providers.

    Mnemeona intentionally keeps only ONE image-generation
    pipeline loaded at a time.

    Provider instances themselves are lightweight and may remain
    registered. Their heavyweight pipelines are what consume VRAM
    and are explicitly unloaded when switching models.
    """

    def __init__(self) -> None:
        self._providers: dict[
            str,
            type[ImageProvider],
        ] = {}

        self._instances: dict[
            str,
            ImageProvider,
        ] = {}

        self._loaded_provider_id: str | None = None

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(
        self,
        provider_class: type[ImageProvider],
    ) -> None:
        """
        Register a provider class.

        Registration does not instantiate or load the provider.
        """

        provider_id = self._get_provider_id(
            provider_class
        )

        if provider_id in self._providers:
            raise ValueError(
                f"Provider already registered: "
                f"{provider_id}"
            )

        self._providers[provider_id] = (
            provider_class
        )

    def unregister(
        self,
        provider_id: str,
    ) -> None:
        """
        Completely remove a provider.

        If the provider is loaded, it is unloaded first.
        """

        if (
            self._loaded_provider_id
            == provider_id
        ):
            self.unload(
                provider_id
            )

        self._instances.pop(
            provider_id,
            None,
        )

        self._providers.pop(
            provider_id,
            None,
        )

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------

    def list_providers(
        self,
    ) -> list[str]:
        return sorted(
            self._providers.keys()
        )

    def has(
        self,
        provider_id: str,
    ) -> bool:
        return (
            provider_id
            in self._providers
        )

    # ------------------------------------------------------------------
    # Provider access
    # ------------------------------------------------------------------

    def get(
        self,
        provider_id: str,
    ) -> ImageProvider:
        """
        Return the provider instance.

        The provider object is created lazily.

        Creating the provider object does NOT load the
        model into VRAM.
        """

        if provider_id not in self._providers:
            raise KeyError(
                f"Unknown image provider: "
                f"{provider_id}"
            )

        if provider_id not in self._instances:
            provider_class = (
                self._providers[
                    provider_id
                ]
            )

            self._instances[
                provider_id
            ] = provider_class()

        return self._instances[
            provider_id
        ]

    # ------------------------------------------------------------------
    # Loading
    # ------------------------------------------------------------------

    def load(
        self,
        provider_id: str,
    ) -> ImageProvider:
        """
        Load exactly one provider.

        Any currently loaded provider is completely
        unloaded BEFORE the requested provider is loaded.
        """

        provider = self.get(
            provider_id
        )

        #
        # Already loaded.
        #

        if (
            self._loaded_provider_id
            == provider_id
        ):
            return provider

        #
        # Never allow two image pipelines to occupy
        # VRAM simultaneously.
        #

        self.unload_all()

        try:
            print(
                f"Loading image provider: "
                f"{provider_id}"
            )

            provider.load()

            self._loaded_provider_id = (
                provider_id
            )

            print(
                f"Image provider loaded: "
                f"{provider_id}"
            )

            self._print_vram_status(
                prefix="After provider load"
            )

            return provider

        except Exception:
            #
            # A failed load must never leave the
            # registry claiming that a provider
            # is loaded.
            #

            self._loaded_provider_id = None

            try:
                provider.unload()
            except Exception:
                pass

            self._cleanup_cuda()

            raise

    # ------------------------------------------------------------------
    # Unloading
    # ------------------------------------------------------------------

    def unload(
        self,
        provider_id: str,
    ) -> None:
        """
        Unload one provider and release its GPU memory.
        """

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
            provider.unload()
        finally:
            if (
                self._loaded_provider_id
                == provider_id
            ):
                self._loaded_provider_id = None

            self._cleanup_cuda()

        self._print_vram_status(
            prefix="After provider unload"
        )

    def unload_all(self) -> None:
        """
        Unload every provider that currently exists.

        Provider instances remain registered, but their
        heavy model pipelines are released.

        This method is the hard boundary that guarantees
        only one image model can occupy VRAM.
        """

        loaded_id = (
            self._loaded_provider_id
        )

        #
        # If we know exactly which provider is loaded,
        # unload that one first.
        #

        if loaded_id is not None:
            provider = (
                self._instances.get(
                    loaded_id
                )
            )

            if provider is not None:
                print(
                    f"Unloading active image "
                    f"provider: {loaded_id}"
                )

                try:
                    provider.unload()
                except Exception as exc:
                    print(
                        "WARNING: provider unload "
                        f"failed for {loaded_id}: "
                        f"{exc}"
                    )

        #
        # Also ask every other provider instance to unload.
        #
        # This protects us if a provider was loaded
        # outside the registry or if the registry state
        # became stale.
        #

        for provider_id, provider in list(
            self._instances.items()
        ):
            if provider_id == loaded_id:
                continue

            try:
                provider.unload()
            except Exception as exc:
                print(
                    "WARNING: provider unload "
                    f"failed for {provider_id}: "
                    f"{exc}"
                )

        #
        # The registry must not claim that anything
        # remains loaded.
        #

        self._loaded_provider_id = None

        #
        # Python garbage collection.
        #

        gc.collect()

        #
        # CUDA cleanup.
        #

        self._cleanup_cuda()

        self._print_vram_status(
            prefix="After unload_all"
        )

    # ------------------------------------------------------------------
    # Switching
    # ------------------------------------------------------------------

    def switch(
        self,
        provider_id: str,
    ) -> ImageProvider:
        """
        Switch the active image provider.

        The old provider is fully unloaded before the
        new provider is loaded.
        """

        if not self.has(
            provider_id
        ):
            raise KeyError(
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

        if (
            self._loaded_provider_id
            is not None
        ):
            print(
                "Previous provider:"
            )
            print(
                f"  {self._loaded_provider_id}"
            )

        print(
            "New provider:"
        )
        print(
            f"  {provider_id}"
        )
        print()

        #
        # HARD VRAM BOUNDARY.
        #

        self.unload_all()

        #
        # Only now load the new provider.
        #

        return self.load(
            provider_id
        )

    # ------------------------------------------------------------------
    # Lazy loading helper
    # ------------------------------------------------------------------

    def ensure_only_loaded(
        self,
        provider_id: str,
    ) -> ImageProvider:
        """
        Ensure exactly one provider is loaded.

        This is intentionally equivalent to load().
        """

        return self.load(
            provider_id
        )

    # ------------------------------------------------------------------
    # State
    # ------------------------------------------------------------------

    @property
    def loaded_provider_id(
        self,
    ) -> str | None:
        """
        ID of the provider whose pipeline is currently
        considered loaded by the registry.
        """

        return self._loaded_provider_id

    def is_loaded(
        self,
        provider_id: str,
    ) -> bool:
        return (
            self._loaded_provider_id
            == provider_id
        )

    def status(
        self,
    ) -> dict[str, Any]:
        """
        Return registry and VRAM status.
        """

        provider_status: dict[
            str,
            Any,
        ] = {}

        for provider_id in (
            self._providers
        ):
            try:
                provider = self.get(
                    provider_id
                )

                provider_status[
                    provider_id
                ] = provider.status()

            except Exception as exc:
                provider_status[
                    provider_id
                ] = {
                    "error": str(exc)
                }

        status: dict[
            str,
            Any,
        ] = {
            "providers": (
                self.list_providers()
            ),
            "loaded_provider": (
                self._loaded_provider_id
            ),
            "provider_status": (
                provider_status
            ),
        }

        status[
            "cuda"
        ] = self._cuda_status()

        return status

    # ------------------------------------------------------------------
    # CUDA management
    # ------------------------------------------------------------------

    @staticmethod
    def _cleanup_cuda() -> None:
        """
        Aggressively release cached CUDA memory.

        This does not forcibly terminate CUDA allocations
        owned by external processes. It cleans memory owned
        by this Python process.
        """

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
            device_index = (
                torch.cuda.current_device()
            )

            device_name = (
                torch.cuda
                .get_device_name(
                    device_index
                )
            )

            free, total = (
                torch.cuda.mem_get_info(
                    device_index
                )
            )

            allocated = (
                torch.cuda.memory_allocated(
                    device_index
                )
            )

            reserved = (
                torch.cuda.memory_reserved(
                    device_index
                )
            )

            return {
                "available": True,
                "device": device_index,
                "name": device_name,
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
                f"CUDA status error: "
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

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _get_provider_id(
        provider_class: type[
            ImageProvider
        ],
    ) -> str:
        """
        Determine provider ID without requiring the
        provider's heavy model to be loaded.
        """

        provider_id = getattr(
            provider_class,
            "PROVIDER_ID",
            None,
        )

        if provider_id:
            return str(
                provider_id
            )

        provider_id = getattr(
            provider_class,
            "id",
            None,
        )

        if isinstance(
            provider_id,
            str,
        ):
            return provider_id

        #
        # Fall back to instantiating the lightweight
        # provider object.
        #

        try:
            instance = provider_class()

            provider_id = getattr(
                instance,
                "id",
                None,
            )

            if callable(
                provider_id
            ):
                provider_id = (
                    provider_id()
                )

            if provider_id:
                return str(
                    provider_id
                )

        except Exception as exc:
            raise RuntimeError(
                "Unable to determine image "
                "provider ID for "
                f"{provider_class}: {exc}"
            ) from exc

        raise RuntimeError(
            "Image provider does not expose "
            "a provider ID: "
            f"{provider_class}"
        )
