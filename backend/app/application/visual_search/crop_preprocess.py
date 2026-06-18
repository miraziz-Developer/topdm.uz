"""Taobao-style query crop normalization before embedding search."""

from __future__ import annotations

import io

from PIL import Image, ImageOps


def prepare_taobao_crop(pil: Image.Image) -> Image.Image:
    """Autocontrast + markaziy kadr + oq fon — Taobao/Temu uslubida query normalizatsiya."""
    crop = pil.convert("RGB")
    crop = ImageOps.autocontrast(crop, cutoff=2)
    crop = ImageOps.exif_transpose(crop)
    w, h = crop.size
    margin_x = max(1, int(w * 0.02))
    margin_y = max(1, int(h * 0.02))
    if w > margin_x * 4 and h > margin_y * 4:
        crop = crop.crop((margin_x, margin_y, w - margin_x, h - margin_y))
        w, h = crop.size
    side = max(w, h, 224)
    canvas = Image.new("RGB", (side, side), (255, 255, 255))
    canvas.paste(crop, ((side - w) // 2, (side - h) // 2))
    if side > 512:
        canvas = canvas.resize((512, 512), Image.Resampling.LANCZOS)
    elif side < 224:
        canvas = canvas.resize((224, 224), Image.Resampling.LANCZOS)
    return canvas


def prepare_taobao_crop_bytes(raw: bytes) -> bytes:
    pil = Image.open(io.BytesIO(raw)).convert("RGB")
    prepared = prepare_taobao_crop(pil)
    buf = io.BytesIO()
    prepared.save(buf, format="JPEG", quality=88)
    return buf.getvalue()


def map_box_to_original(
    box: tuple[float, float, float, float] | list[float],
    orig_w: int,
    orig_h: int,
    *,
    target_size: int = 640,
) -> list[int]:
    """Kvadrat pad qilingan detektor koordinatalarini original rasmga qaytaradi."""
    xmin, ymin, xmax, ymax = (float(v) for v in box)
    scale = target_size / max(orig_w, orig_h, 1)
    pad_x = (target_size - orig_w * scale) / 2
    pad_y = (target_size - orig_h * scale) / 2
    orig_xmin = int((xmin - pad_x) / scale)
    orig_ymin = int((ymin - pad_y) / scale)
    orig_xmax = int((xmax - pad_x) / scale)
    orig_ymax = int((ymax - pad_y) / scale)
    return [
        max(0, orig_xmin),
        max(0, orig_ymin),
        min(orig_w, orig_xmax),
        min(orig_h, orig_ymax),
    ]
