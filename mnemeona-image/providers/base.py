from __future__ import annotations

from abc import ABC, abstractmethod

from core.models import GenerationRequest, GenerationResult


class ImageProvider(ABC):
    """Contract every Mnemeona image AI adapter must implement."""

    @property
    @abstractmethod
    def id(self) -> str:
        raise NotImplementedError

    @property
    @abstractmethod
    def name(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def status(self) -> dict:
        raise NotImplementedError

    @abstractmethod
    def generate(self, request: GenerationRequest) -> GenerationResult:
        raise NotImplementedError

    def unload(self) -> None:
        """Release GPU/model memory. Providers may override."""
        return None

    def close(self) -> None:
        self.unload()
