from __future__ import annotations

from typing import Protocol


class NotifierGateway(Protocol):
    async def send_message(self, chat_id: int, text: str) -> None:
        """Send a plain Telegram text message."""
