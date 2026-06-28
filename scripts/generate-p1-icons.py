#!/usr/bin/env python3
"""Generate simple placeholder PNG icons for Phase 14 P1 (and P3) UI assets."""
from __future__ import annotations

import hashlib
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / "client" / "public" / "icons"
SIZE = 64

# (relative path, hue seed 0-360)
ICONS: list[tuple[str, int]] = [
    ("placeholder.png", 0),
    ("skills/power-strike.png", 210),
    ("items/adena.png", 48),
    ("items/wooden-arrow.png", 35),
    ("items/healing-potion.png", 120),
    ("items/soulshot.png", 260),
    ("items/squires-sword.png", 200),
]

P3_ICONS: list[tuple[str, int]] = [
    ("items/apprentices-earring.png", 300),
    ("items/magic-ring.png", 280),
    ("items/magic-necklace.png", 190),
    ("items/short-bow.png", 25),
    ("items/tunic.png", 160),
    ("items/stockings.png", 220),
    ("items/stem.png", 90),
    ("items/animal-skin.png", 30),
    ("items/thread.png", 340),
    ("items/charcoal.png", 0),
    ("items/recipe-broadsword.png", 15),
    ("items/recipe-bow.png", 45),
]


def hsl_to_rgb(h: float, s: float, l: float) -> tuple[int, int, int]:
    import colorsys

    r, g, b = colorsys.hls_to_rgb(h / 360, l, s)
    return int(r * 255), int(g * 255), int(b * 255)


def draw_icon(path: str, hue: int) -> None:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    seed = int(hashlib.md5(path.encode()).hexdigest()[:8], 16)
    fg = hsl_to_rgb(hue, 0.65, 0.55)
    accent = hsl_to_rgb((hue + 40) % 360, 0.7, 0.45)
    margin = 8
    shape = seed % 4
    if shape == 0:
        draw.ellipse([margin, margin, SIZE - margin, SIZE - margin], fill=fg + (230,))
    elif shape == 1:
        draw.rounded_rectangle(
            [margin, margin, SIZE - margin, SIZE - margin], radius=6, fill=fg + (230,)
        )
    elif shape == 2:
        cx, cy = SIZE // 2, SIZE // 2
        r = SIZE // 2 - margin
        draw.polygon(
            [(cx, cy - r), (cx + r, cy + r // 2), (cx - r, cy + r // 2)],
            fill=fg + (230,),
        )
    else:
        draw.rectangle([margin, margin, SIZE - margin, SIZE - margin], fill=fg + (230,))
    draw.ellipse([SIZE // 2 - 4, SIZE // 2 - 4, SIZE // 2 + 4, SIZE // 2 + 4], fill=accent + (255,))
    out = ROOT / path
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG")


def main() -> None:
    import sys

    targets = ICONS + (P3_ICONS if "--p3" in sys.argv else [])
    for rel, hue in targets:
        draw_icon(rel, hue)
        print(f"wrote {ROOT / rel}")


if __name__ == "__main__":
    main()
