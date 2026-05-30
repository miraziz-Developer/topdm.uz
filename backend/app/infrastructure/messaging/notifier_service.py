from __future__ import annotations

from app.domain.interfaces.notifier_gateway import NotifierGateway
from app.infrastructure.messaging.telegram_notifier import TelegramNotifier


class TelegramNotifierGateway(NotifierGateway):
    """Infrastructure notifier: all outbound Telegram traffic goes through here (DI-friendly)."""

    def __init__(self, bot_token: str) -> None:
        self._tg = TelegramNotifier(bot_token)

    async def send_message(self, chat_id: int, text: str) -> None:
        await self._tg.send_message(chat_id, text)
