from __future__ import annotations

import uuid

from app.domain.interfaces.notifier_gateway import NotifierGateway
from app.infrastructure.bots.merchant_crm_links import crm_webapp_reply_markup
from app.infrastructure.messaging.telegram_notifier import TelegramNotifier


class TelegramNotifierGateway(NotifierGateway):
    """Infrastructure notifier: all outbound Telegram traffic goes through here (DI-friendly)."""

    def __init__(self, bot_token: str) -> None:
        self._tg = TelegramNotifier(bot_token)

    async def send_message(self, chat_id: int, text: str) -> None:
        await self._tg.send_message(chat_id, text)

    async def send_merchant_crm(
        self,
        chat_id: int,
        text: str,
        *,
        shop_id: uuid.UUID,
        crm_next: str | None = None,
    ) -> None:
        markup = crm_webapp_reply_markup(shop_id, next_path=crm_next)
        await self._tg.send_message(chat_id, text, reply_markup=markup)
