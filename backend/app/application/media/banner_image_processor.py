from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image, ImageOps

# Premium carousel cards: clean vertical rectangle (~4:5)
TARGET_ASPECT = 4 / 5
MAX_BYTES = 500_000
TARGET_WIDTH = 1080
WEBP_QUALITY_START = 88


@dataclass(frozen=True)
class ProcessedBannerImage:
    data: bytes
    content_type: str
    extension: str
    width: int
    height: int
    byte_size: int


def process_banner_upload(raw: bytes, *, max_bytes: int = MAX_BYTES) -> ProcessedBannerImage:
    """Resize/crop to 4:5, encode WebP, compress under max_bytes."""
    with Image.open(io.BytesIO(raw)) as img:
        img = ImageOps.exif_transpose(img.convert("RGB"))
        w, h = img.size
        target_h = int(TARGET_WIDTH / TARGET_ASPECT)
        # Center-crop to target aspect
        current_aspect = w / h if h else 1
        if current_aspect > TARGET_ASPECT:
            new_w = int(h * TARGET_ASPECT)
            left = (w - new_w) // 2
            img = img.crop((left, 0, left + new_w, h))
        else:
            new_h = int(w / TARGET_ASPECT)
            top = (h - new_h) // 2
            img = img.crop((0, top, w, top + new_h))
        img = img.resize((TARGET_WIDTH, target_h), Image.Resampling.LANCZOS)

        quality = WEBP_QUALITY_START
        out = io.BytesIO()
        while quality >= 40:
            out.seek(0)
            out.truncate(0)
            img.save(out, format="WEBP", quality=quality, method=6)
            if out.tell() <= max_bytes:
                break
            quality -= 8

        data = out.getvalue()
        if len(data) > max_bytes:
            raise ValueError("image_too_large_after_compression")

        return ProcessedBannerImage(
            data=data,
            content_type="image/webp",
            extension="webp",
            width=TARGET_WIDTH,
            height=target_h,
            byte_size=len(data),
        )
