from __future__ import annotations

from pathlib import Path
from uuid import UUID

from loguru import logger

from app.application.media.media_availability import local_path_for_media_url
from app.core.config import get_settings


def _storage_key_from_url(url: str) -> str | None:
    raw = (url or "").strip()
    if not raw:
        return None
    if raw.startswith("http://") or raw.startswith("https://"):
        for marker in ("/storage/v1/object/public/", "/"):
            if "stories/" in raw:
                idx = raw.find("stories/")
                return raw[idx:]
            if "products/" in raw:
                idx = raw.find("products/")
                return raw[idx:]
        return None
    if "/media/" in raw:
        return raw.split("/media/", 1)[-1].lstrip("/")
    return None


async def delete_media_by_url(url: str | None) -> bool:
    """Mahalliy disk yoki S3/OSS — story/product rasmini o'chirish."""
    if not url or not url.strip():
        return False

    settings = get_settings()
    backend = (settings.media_storage_backend or "local").strip().lower()

    if backend == "local":
        path = local_path_for_media_url(url)
        if path and path.is_file():
            path.unlink(missing_ok=True)
            return True
        return False

    if backend == "s3":
        key = _storage_key_from_url(url)
        if not key or not settings.s3_bucket:
            return False
        try:
            from app.infrastructure.storage.s3_async import delete_object

            await delete_object(settings=settings, key=key)
            return True
        except Exception as exc:
            logger.warning("media_delete_s3_failed", url=url, error=str(exc))
            return False

    logger.debug("media_delete_skip_backend", backend=backend, url=url)
    return False
