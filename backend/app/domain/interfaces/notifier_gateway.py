from __future__ import annotations

import uuid
from typing import Protocol


class NotifierGateway(Protocol):
    async def send_message(self, chat_id: int, text: str) -> None:
        """Send a plain Telegram text message."""

    async def send_merchant_crm(
        self,
        chat_id: int,
        text: str,
        *,
        shop_id: uuid.UUID,
        crm_next: str | None = None,
        reply_markup: dict | None = None,
    ) -> None:
        """Telegram xabar + CRM WebApp tugmasi (bot va web bir tizim)."""
