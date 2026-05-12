from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)


class TelegramNotifier:
    def __init__(self, bot_token: str) -> None:
        self._bot_token = bot_token

    async def notify_shop_lead(self, chat_id: int, message: str) -> None:
        if not self._bot_token or not chat_id:
            return
        url = f"https://api.telegram.org/bot{self._bot_token}/sendMessage"
        payload = {"chat_id": chat_id, "text": message}
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                await client.post(url, json=payload)
        except Exception:
            logger.warning("telegram_notification_failed", extra={"chat_id": chat_id})
