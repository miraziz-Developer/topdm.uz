"""Taobao-style visual fingerprint (768-d): rang, tuzilma, kontur + pHash dublikat."""

from __future__ import annotations

import io
import math

from PIL import Image, ImageFilter, ImageOps

VISUAL_DIM = 768


def image_visual_signature(image: bytes | Image.Image) -> list[float]:
    if isinstance(image, bytes):
        pil = Image.open(io.BytesIO(image)).convert("RGB")
    else:
        pil = image.convert("RGB")
    pil = _pad_square(pil)
    parts: list[float] = []
    parts.extend(_rgb_grid(pil, 11))  # 363
    parts.extend(_hue_histogram(pil, 40))  # 40
    parts.extend(_channel_histogram(pil.convert("HSV"), channel=1, bins=16))  # sat 16
    parts.extend(_channel_histogram(pil.convert("HSV"), channel=2, bins=16))  # val 16
    parts.extend(_luma_grid(pil, 9))  # 81
    parts.extend(_edge_grid(pil, 8))  # 64
    parts.extend(_color_moments(pil))  # 12
    parts.extend(_phash_bits(pil))  # 64
    if len(parts) < VISUAL_DIM:
        parts.extend([0.0] * (VISUAL_DIM - len(parts)))
    return _l2_normalize(parts[:VISUAL_DIM])


def image_phash_hex(image: bytes | Image.Image) -> str:
    if isinstance(image, bytes):
        pil = Image.open(io.BytesIO(image)).convert("L")
    else:
        pil = image.convert("L")
    w, h = pil.size
    side = max(w, h, 1)
    canvas = Image.new("L", (side, side), 128)
    canvas.paste(pil, ((side - w) // 2, (side - h) // 2))
    pil = canvas.resize((32, 32), Image.Resampling.LANCZOS)
    pil = pil.filter(ImageFilter.DETAIL)
    pixels = list(pil.getdata())
    avg = sum(pixels) / len(pixels)
    bits = "".join("1" if p >= avg else "0" for p in pixels)
    return f"{int(bits, 2):064x}"


def phash_hamming(hex_a: str, hex_b: str) -> int:
    if not hex_a or not hex_b:
        return 64
    try:
        x = int(hex_a, 16) ^ int(hex_b, 16)
        return x.bit_count()
    except ValueError:
        return 64


def ensemble_query_signatures(image: bytes | Image.Image) -> list[list[float]]:
    """Bir nechta crop variant — Taobao multi-scale."""
    if isinstance(image, bytes):
        base = Image.open(io.BytesIO(image)).convert("RGB")
    else:
        base = image.convert("RGB")
    variants = [
        base,
        _center_crop(base, 0.9),
        ImageOps.autocontrast(_pad_square(base)),
    ]
    return [image_visual_signature(v) for v in variants]


def _pad_square(pil: Image.Image) -> Image.Image:
    w, h = pil.size
    side = max(w, h, 1)
    canvas = Image.new("RGB", (side, side), (128, 128, 128))
    canvas.paste(pil, ((side - w) // 2, (side - h) // 2))
    return canvas


def _center_crop(pil: Image.Image, ratio: float) -> Image.Image:
    w, h = pil.size
    nw, nh = int(w * ratio), int(h * ratio)
    left = (w - nw) // 2
    top = (h - nh) // 2
    return pil.crop((left, top, left + nw, top + nh))


def _rgb_grid(pil: Image.Image, size: int) -> list[float]:
    g = pil.resize((size, size), Image.Resampling.LANCZOS)
    return [c / 255.0 for rgb in g.getdata() for c in rgb]


def _luma_grid(pil: Image.Image, size: int) -> list[float]:
    g = pil.convert("L").resize((size, size), Image.Resampling.LANCZOS)
    return [p / 255.0 for p in g.getdata()]


def _hue_histogram(pil: Image.Image, bins: int) -> list[float]:
    hsv = pil.convert("HSV")
    hist = [0.0] * bins
    for h, s, v in hsv.getdata():
        if s < 20 or v < 20:
            continue
        idx = min(bins - 1, int(h * bins / 256))
        hist[idx] += 1.0
    total = sum(hist) or 1.0
    return [x / total for x in hist]


def _channel_histogram(pil: Image.Image, *, channel: int, bins: int) -> list[float]:
    hist = [0.0] * bins
    for px in pil.getdata():
        val = px[channel] if isinstance(px, tuple) else px
        idx = min(bins - 1, int(val * bins / 256))
        hist[idx] += 1.0
    total = sum(hist) or 1.0
    return [x / total for x in hist]


def _edge_grid(pil: Image.Image, size: int) -> list[float]:
    edges = pil.convert("L").filter(ImageFilter.FIND_EDGES)
    g = edges.resize((size, size), Image.Resampling.LANCZOS)
    return [min(1.0, p / 255.0) for p in g.getdata()]


def _color_moments(pil: Image.Image) -> list[float]:
    rgb = pil.resize((64, 64), Image.Resampling.BILINEAR)
    rs, gs, bs = [], [], []
    for r, g, b in rgb.getdata():
        rs.append(r)
        gs.append(g)
        bs.append(b)
    out: list[float] = []
    for arr in (rs, gs, bs):
        mean = sum(arr) / len(arr) / 255.0
        var = sum((x / 255.0 - mean) ** 2 for x in arr) / len(arr)
        out.extend([mean, math.sqrt(var)])
    return out


def _phash_bits(pil: Image.Image) -> list[float]:
    hx = image_phash_hex(pil)
    bits = bin(int(hx, 16))[2:].zfill(64)
    return [1.0 if b == "1" else 0.0 for b in bits]


def _l2_normalize(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]
