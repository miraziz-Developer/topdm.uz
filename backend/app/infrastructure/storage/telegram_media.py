from __future__ import annotations

import uuid

import httpx
from loguru import logger

from app.core.config import get_settings
from app.infrastructure.storage.object_store import ObjectMediaStore


class TelegramMediaStore:
    """Download Telegram file_id and persist via configured object media backend."""

    def __init__(self) -> None:
        self._settings = get_settings()
        self._object_store = ObjectMediaStore()

    async def download_telegram_file(self, file_id: str) -> tuple[bytes, str]:
        token = self._settings.telegram_bot_token
        if not token:
            raise ValueError("TELEGRAM_BOT_TOKEN is not configured")

        async with httpx.AsyncClient(timeout=30) as client:
            meta = await client.get(f"https://api.telegram.org/bot{token}/getFile", params={"file_id": file_id})
            meta.raise_for_status()
            payload = meta.json()
            if not payload.get("ok"):
                raise ValueError("Telegram getFile failed")
            file_path = payload["result"]["file_path"]
            file_resp = await client.get(f"https://api.telegram.org/file/bot{token}/{file_path}")
            file_resp.raise_for_status()

        mime = "image/jpeg"
        if file_path.lower().endswith(".png"):
            mime = "image/png"
        elif file_path.lower().endswith(".webp"):
            mime = "image/webp"
        return file_resp.content, mime

    async def resolve_permanent_url(
        self,
        *,
        shop_id: uuid.UUID,
        telegram_file_id: str | None,
        fallback_placeholder: str | None = None,
    ) -> str:
        if not telegram_file_id:
            if fallback_placeholder:
                return fallback_placeholder
            raise ValueError("No image source for product")

        try:
            data, mime = await self.download_telegram_file(telegram_file_id)
            ext = "jpg"
            if "png" in mime:
                ext = "png"
            elif "webp" in mime:
                ext = "webp"
            url = await self._object_store.save_product_image(
                shop_id=shop_id,
                image_bytes=data,
                extension=ext,
                content_type=mime,
            )
            logger.info(
                "product_image_stored",
                shop_id=str(shop_id),
                backend=self._object_store.backend,
                url=url[:120],
            )
            return url
        except Exception as exc:
            logger.warning("telegram_image_download_failed", error=str(exc), file_id=telegram_file_id)
            if fallback_placeholder:
                return fallback_placeholder
            raise ValueError("Failed to download product image from Telegram") from exc
