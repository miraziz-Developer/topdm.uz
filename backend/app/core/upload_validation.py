"""Upload fayllarni magic-byte bo'yicha tekshirish (Content-Type ga ishonmaymiz)."""
from __future__ import annotations

from fastapi import HTTPException

_IMAGE_MAX_DEFAULT = 8 * 1024 * 1024
_VIDEO_MAX_DEFAULT = 80 * 1024 * 1024
_REVIEW_PHOTO_MAX = 5 * 1024 * 1024
_REVIEW_PHOTO_MAX_COUNT = 5


def sniff_image_mime(raw: bytes) -> str | None:
    if len(raw) < 12:
        return None
    if raw[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if raw[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if raw[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return "image/webp"
    return None


def sniff_video_mime(raw: bytes) -> str | None:
    if len(raw) < 12:
        return None
    if raw[4:8] == b"ftyp":
        brand = raw[8:12]
        if brand in {b"mp41", b"mp42", b"isom", b"avc1", b"qt  "}:
            return "video/mp4"
        return "video/mp4"
    if raw[:4] == b"\x1aE\xdf\xa3":
        return "video/webm"
    return None


def validate_image_bytes(
    raw: bytes,
    *,
    max_bytes: int = _IMAGE_MAX_DEFAULT,
    label: str = "Rasm",
) -> str:
    if not raw:
        raise HTTPException(status_code=400, detail=f"{label} bo'sh")
    if len(raw) > max_bytes:
        raise HTTPException(status_code=400, detail=f"{label} hajmi limitdan oshdi")
    mime = sniff_image_mime(raw)
    if not mime:
        raise HTTPException(status_code=400, detail=f"{label} formati qo'llab-quvvatlanmaydi (JPG/PNG/WebP/GIF)")
    return mime


def validate_video_bytes(raw: bytes, *, max_bytes: int = _VIDEO_MAX_DEFAULT) -> str:
    if not raw:
        raise HTTPException(status_code=400, detail="Video bo'sh")
    if len(raw) > max_bytes:
        raise HTTPException(status_code=400, detail="Video hajmi limitdan oshdi")
    mime = sniff_video_mime(raw)
    if not mime:
        raise HTTPException(status_code=400, detail="Faqat MP4/WebM video qabul qilinadi")
    return mime
