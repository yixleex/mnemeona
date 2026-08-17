#!/usr/bin/env python3

from __future__ import annotations

import time
from pathlib import Path

from lcm_engine import LCMEngine


ROOT = Path(
    __file__
).resolve().parent

MODEL_PATH = (
    ROOT
    / "models"
    / "LCM_Dreamshaper_v7"
)

OUTPUT_PATH = (
    ROOT
    / "test-output.png"
)


PROMPT = """
A cinematic fantasy character portrait
of a young woman named Elara.

She has long silver hair,
emerald green eyes,
pale skin,
and a small scar above her
left eyebrow.

She wears practical dark leather
fantasy clothing with subtle
silver embroidery.

Her expression is intelligent,
determined, and slightly melancholic.

Detailed face,
beautiful character design,
fantasy novel concept art,
cinematic lighting,
detailed clothing,
dramatic atmosphere,
professional digital illustration.

No text,
no captions,
no logo,
no watermark.
""".strip()


def main() -> int:
    print()
    print(
        "=============================================="
    )
    print(
        "       Mnemeona LCM DreamShaper Test"
    )
    print(
        "=============================================="
    )
    print()

    engine = LCMEngine(
        MODEL_PATH
    )

    print(
        "Engine status:"
    )

    print(
        engine.status()
    )

    print()

    start = time.perf_counter()

    image, seed = (
        engine.generate(
            prompt=PROMPT,
            width=768,
            height=768,
            steps=4,
        )
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
    print(
        "Generation successful."
    )
    print()

    print(
        "Seed:"
    )

    print(
        f"  {seed}"
    )

    print()

    print(
        "Size:"
    )

    print(
        f"  {image.width} × "
        f"{image.height}"
    )

    print()

    print(
        "Time:"
    )

    print(
        f"  {elapsed:.2f} seconds"
    )

    print()

    print(
        "Output:"
    )

    print(
        f"  {OUTPUT_PATH}"
    )

    print()

    return 0


if __name__ == "__main__":
    raise SystemExit(
        main()
    )
