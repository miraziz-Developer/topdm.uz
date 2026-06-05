"""Mahalliy media fayllar diskda bormi — feedda buzuk URLlarni filtrlash."""
from __future__ import annotations

from pathlib import Path
from uuid import UUID

_UPLOAD_ROOT = Path(__file__).resolve().parents[3] / "uploads"

_SEGMENT_ROOTS = {
    "products": _UPLOAD_ROOT / "products",
    "stories": _UPLOAD_ROOT / "stories",
    "reels": _UPLOAD_ROOT / "reels",
    "banners": _UPLOAD_ROOT / "banners",
    "reviews": _UPLOAD_ROOT / "reviews",
    "shops": _UPLOAD_ROOT / "shops",
}


def local_path_for_media_url(url: str | None) -> Path | None:
    raw = (url or "").strip()
    if not raw.startswith("/api/") or "/media/" not in raw:
        return None
    parts = raw.split("/media/", 1)[-1].strip("/").split("/")
    if len(parts) < 3:
        return None
    segment, owner_id = parts[0], parts[1]
    if segment == "shops" and len(parts) >= 4:
        kind, filename = parts[2], parts[3]
        if ".." in filename or "/" in filename or ".." in kind:
            return None
        try:
            UUID(owner_id)
        except ValueError:
            return None
        return _UPLOAD_ROOT / "shops" / owner_id / kind / filename
    filename = parts[2]
    root = _SEGMENT_ROOTS.get(segment)
    if not root:
        if segment == "reviews" and len(parts) >= 3:
            return _UPLOAD_ROOT / "reviews" / owner_id / filename
        return None
    try:
        UUID(owner_id)
    except ValueError:
        return None
    if ".." in filename or "/" in filename:
        return None
    return root / owner_id / filename


def media_file_exists(url: str | None) -> bool:
    """Tashqi URL doim mavjud deb hisoblanadi; mahalliy path diskda tekshiriladi."""
    raw = (url or "").strip()
    if not raw:
        return False
    if raw.startswith("http://") or raw.startswith("https://"):
        return True
    path = local_path_for_media_url(raw)
    if path is None:
        return False
    return path.is_file() and path.stat().st_size > 0
