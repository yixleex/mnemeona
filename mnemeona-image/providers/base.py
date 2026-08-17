from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from core.models import (
    GenerationRequest,
    GenerationResult,
)


class ImageProvider(ABC):
    """
    Base interface for every Mnemeona
    image-generation provider.

    Providers are completely independent of
    the main Mnemeona application.
    """

    @property
    @abstractmethod
    def id(self) -> str:
        raise NotImplementedError

    @property
    @abstractmethod
    def name(self) -> str:
        raise NotImplementedError

    @property
    def version(self) -> str:
        return "1.0.0"

    def settings_schema(self) -> dict[str, Any]:
        """
        Return provider-specific settings metadata.

        The frontend can eventually use this to
        dynamically build the settings UI.
        """
        return {}

    @abstractmethod
    def status(self) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def generate(
        self,
        request: GenerationRequest,
    ) -> GenerationResult:
        raise NotImplementedError

    def unload(self) -> None:
        """
        Release model/GPU memory.

        Providers that don't keep models in memory
        can simply use this default implementation.
        """
        return None

    def close(self) -> None:
        self.unload()
