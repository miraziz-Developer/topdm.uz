from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image, ImageOps

# Banner: proporsiya saqlanadi, maksimal kenglik/balandlik chegarasi
MAX_BYTES = 500_000
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
    """Rasm proporsiyasini saqlab, maksimal o'lchamga moslashtirish (kesmasdan)."""
    max_w, max_h = 1600, 900
    with Image.open(io.BytesIO(raw)) as img:
        img = ImageOps.exif_transpose(img.convert("RGB"))
        w, h = img.size
        scale = min(max_w / w, max_h / h, 1.0)
        new_w = max(1, int(w * scale))
        new_h = max(1, int(h * scale))
        if scale < 1.0:
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        out_w, out_h = img.size

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
            width=out_w,
            height=out_h,
            byte_size=len(data),
        )
