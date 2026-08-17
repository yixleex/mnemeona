from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class GenerationRequest:
    prompt: str
    width: int = 768
    height: int = 768
    steps: int = 4
    seed: int | None = None
    settings: dict[str, Any] = field(default_factory=dict)


@dataclass
class GenerationResult:
    image: Any
    seed: int
    provider: str
    metadata: dict[str, Any] = field(default_factory=dict)
