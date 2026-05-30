from __future__ import annotations

from fastapi import Depends

from app.core.config import Settings, get_settings
from app.domain.interfaces.notifier_gateway import NotifierGateway
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway


def get_notifier_gateway(settings: Settings = Depends(get_settings)) -> NotifierGateway:
    return TelegramNotifierGateway(settings.telegram_bot_token)
