"""Download or load catalog product photos for visual fingerprint indexing."""

from __future__ import annotations

import re
from pathlib import Path

import httpx

# backend/app/application/visual_search → backend/
_BACKEND_ROOT = Path(__file__).resolve().parents[3]
_UPLOAD_PRODUCTS = _BACKEND_ROOT / "uploads" / "products"

_MEDIA_PRODUCT_RE = re.compile(
    r"(?:https?://[^/]+)?(?:/api/v1)?/media/products/([0-9a-f-]{36})/([^/?#]+)",
    re.IGNORECASE,
)


def read_local_product_image(url: str) -> bytes | None:
    """Resolve /api/v1/media/products/{shop}/{file} to disk under uploads/products."""
    if not url:
        return None
    match = _MEDIA_PRODUCT_RE.search(url.strip())
    if not match:
        return None
    shop_id, filename = match.group(1), match.group(2)
    if ".." in filename or "/" in filename:
        return None
    path = _UPLOAD_PRODUCTS / shop_id / filename
    if path.is_file():
        return path.read_bytes()
    return None


async def fetch_image_bytes(url: str, *, timeout: float = 12.0) -> bytes | None:
    local = read_local_product_image(url)
    if local:
        return local

    raw = (url or "").strip()
    if raw.startswith("/api/"):
        from app.core.config import get_settings

        base = get_settings().site_url.rstrip("/")
        raw = f"{base}{raw}"

    if not raw or not raw.startswith(("http://", "https://")):
        return None
    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            headers={"User-Agent": "BozorAI/1.0 visual-index"},
        ) as client:
            response = await client.get(raw)
            if response.status_code == 200 and response.content:
                return response.content
    except Exception:
        return None
    return None
