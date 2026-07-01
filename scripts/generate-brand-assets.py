#!/usr/bin/env python3
"""Bozorliii wordmark — checkerboard/oq fonni kesib, shaffof PNG variantlar."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "brand" / "assets"
MASTER = SRC / "bozorliii-logo-master.png"
TAGLINE = "INNOVATSION BOZOR PLATFORMASI"


def is_background_pixel(r: int, g: int, b: int, a: int) -> bool:
    if a < 12:
        return True
    if abs(r - g) > 12 or abs(g - b) > 12 or abs(r - b) > 12:
        return False
    return min(r, g, b) >= 182


def remove_neutral_pixels(im: Image.Image) -> Image.Image:
    """Checkerboard/kulrang nuqtalarni ham ichkaridan olib tashlaydi."""
    rgba = im.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 12:
                px[x, y] = (r, g, b, 0)
                continue
            if is_background_pixel(r, g, b, a):
                px[x, y] = (r, g, b, 0)
    return rgba


def flood_remove_background(im: Image.Image) -> Image.Image:
    rgba = im.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    visited = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    def push(x: int, y: int) -> None:
        idx = y * w + x
        if visited[idx]:
            return
        r, g, b, a = px[x, y]
        if not is_background_pixel(r, g, b, a):
            return
        visited[idx] = 1
        q.append((x, y))

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)

    while q:
        x, y = q.popleft()
        px[x, y] = (px[x, y][0], px[x, y][1], px[x, y][2], 0)
        if x > 0:
            push(x - 1, y)
        if x + 1 < w:
            push(x + 1, y)
        if y > 0:
            push(x, y - 1)
        if y + 1 < h:
            push(x, y + 1)

    return remove_neutral_pixels(rgba)


def trim_content(im: Image.Image) -> Image.Image:
    rgba = im.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size

    def col_count(x: int) -> int:
        return sum(1 for y in range(h) if px[x, y][3] > 40)

    def row_count(y: int) -> int:
        return sum(1 for x in range(w) if px[x, y][3] > 40)

    minx = next((x for x in range(w) if col_count(x) >= 8), 0)
    maxx = next((x for x in range(w - 1, -1, -1) if col_count(x) >= 8), w - 1)
    miny = next((y for y in range(h) if row_count(y) >= 8), 0)
    maxy = next((y for y in range(h - 1, -1, -1) if row_count(y) >= 8), h - 1)
    if maxx <= minx or maxy <= miny:
        bbox = rgba.getbbox()
        return rgba.crop(bbox) if bbox else rgba
    return rgba.crop((minx, miny, maxx + 1, maxy + 1))


def process_master(im: Image.Image) -> Image.Image:
    return trim_content(flood_remove_background(im))


def square_pad(im: Image.Image, *, padding_ratio: float = 0.06) -> Image.Image:
    rgba = im.convert("RGBA")
    side = max(rgba.width, rgba.height)
    pad = max(1, int(side * padding_ratio))
    canvas = Image.new("RGBA", (side + pad * 2, side + pad * 2), (0, 0, 0, 0))
    x = (canvas.width - rgba.width) // 2
    y = (canvas.height - rgba.height) // 2
    canvas.paste(rgba, (x, y), rgba)
    return canvas


def resize_square(im: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    fitted = im.copy()
    fitted.thumbnail((size, size), Image.Resampling.LANCZOS)
    x = (size - fitted.width) // 2
    y = (size - fitted.height) // 2
    canvas.paste(fitted, (x, y), fitted)
    return canvas


def crop_b_icon(wordmark: Image.Image) -> Image.Image:
    """Faqat katta gradient B."""
    w, h = wordmark.size
    px = wordmark.convert("RGBA").load()
    col_density = [sum(1 for y in range(h) if px[x, y][3] > 40) for x in range(w)]
    peak = max(col_density) if col_density else 1
    cut = w
    for x in range(int(w * 0.08), w):
        if col_density[x] < peak * 0.32:
            cut = x + 2
            break
    if cut >= w:
        cut = max(int(w * 0.26), int(h * 0.92))
    return trim_content(wordmark.crop((0, 0, min(cut, w), h)))


def with_tagline(wordmark: Image.Image) -> Image.Image:
    wm = wordmark.convert("RGBA")
    scale = 3
    wm_big = wm.resize((wm.width * scale, wm.height * scale), Image.Resampling.LANCZOS)
    tag_h = int(wm_big.height * 0.28)
    canvas = Image.new("RGBA", (wm_big.width, wm_big.height + tag_h), (0, 0, 0, 0))
    canvas.paste(wm_big, (0, 0), wm_big)
    draw = ImageDraw.Draw(canvas)
    font_size = max(18, int(wm_big.height * 0.11))
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", font_size)
    except OSError:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), TAGLINE, font=font)
    tw = bbox[2] - bbox[0]
    tx = (canvas.width - tw) // 2
    ty = wm_big.height + int(tag_h * 0.18)
    draw.text((tx, ty), TAGLINE, fill=(11, 29, 63, 255), font=font)
    return trim_content(canvas)


def save_png(im: Image.Image, path: Path) -> None:
    im.save(path, optimize=True)


def main() -> None:
    if not MASTER.exists():
        raise SystemExit(f"Master logo topilmadi: {MASTER}")

    wordmark = process_master(Image.open(MASTER))
    icon = square_pad(crop_b_icon(wordmark))
    logo_full = with_tagline(wordmark)

    save_png(wordmark, SRC / "bozorliii-wordmark-compact.png")
    save_png(wordmark, SRC / "bozorliii-logo-lockup.png")
    save_png(wordmark, SRC / "bozorliii-wordmark.png")
    save_png(logo_full, SRC / "bozorliii-logo.png")
    save_png(icon, SRC / "bozorliii-icon.png")

    for size, name in (
        (32, "bozorliii-icon-32.png"),
        (180, "bozorliii-icon-180.png"),
        (192, "bozorliii-icon-192.png"),
        (512, "bozorliii-icon-512.png"),
    ):
        save_png(resize_square(icon, size), SRC / name)

    save_png(resize_square(icon, 32), SRC / "favicon.png")
    print("Shaffof logo (katta B) yaratildi:", SRC)


if __name__ == "__main__":
    main()
