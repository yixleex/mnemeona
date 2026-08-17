#!/usr/bin/env python3

from __future__ import annotations

import sys
import time
from pathlib import Path

from PIL import Image

from zimage_engine import ZImageEngine


ROOT = Path(__file__).resolve().parent

MODEL_PATH = (
    ROOT
    / "models"
    / "Z-Image-Turbo"
)

OUTPUT_PATH = (
    ROOT
    / "test-output.png"
)


PROMPT = """
A cinematic fantasy novel character portrait of a
young woman named Elara.

She has long silver hair, emerald green eyes,
pale skin, and a small scar above her left eyebrow.

She wears practical dark leather fantasy clothing
with subtle silver embroidery.

Her expression is intelligent, determined, and
slightly melancholic.

Chest-up portrait, clear face, strong facial identity,
natural anatomy, detailed clothing, cinematic lighting,
moody fantasy atmosphere, highly detailed environment.

No text, no captions, no logo, no watermark.
""".strip()


def main() -> int:
    print()
    print("==============================================")
    print("      Mnemeona Z-Image-Turbo Test")
    print("==============================================")
    print()

    engine = ZImageEngine(
        MODEL_PATH
    )

    print("Engine status:")
    print(engine.status())
    print()

    start = time.perf_counter()

    image, seed = engine.generate(
        prompt=PROMPT,
        width=768,
        height=1024,
        steps=8,
    )

    elapsed = (
        time.perf_counter()
        - start
    )

    image.save(
        OUTPUT_PATH,
        format="PNG",
    )

    print()
    print("Generation successful.")
    print()
    print("Seed:")
    print(f"  {seed}")
    print()
    print("Size:")
    print(
        f"  {image.width} × {image.height}"
    )
    print()
    print("Time:")
    print(
        f"  {elapsed:.2f} seconds"
    )
    print()
    print("Output:")
    print(f"  {OUTPUT_PATH}")
    print()

    return 0


if __name__ == "__main__":
    raise SystemExit(
        main()
    )
