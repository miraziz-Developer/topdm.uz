from __future__ import annotations

import random

from fastapi import HTTPException

from app.core.config import get_settings
from app.infrastructure.messaging.telegram_otp import (
    BotNotStartedError,
    TelegramOtpError,
    normalize_telegram_username,
    telegram_otp_gateway,
)


async def issue_and_send_telegram_otp(
    *,
    telegram_username: str,
    link_user_id: str | None = None,
) -> dict:
    settings = get_settings()
    username = normalize_telegram_username(telegram_username)
    otp = f"{random.randint(100000, 999999)}"

    try:
        await telegram_otp_gateway.send_otp(username=username, otp=otp, link_user_id=link_user_id)
    except BotNotStartedError as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    except TelegramOtpError as exc:
        status = 503 if exc.code == "telegram_not_configured" else 400
        raise HTTPException(status_code=status, detail={"code": exc.code, "message": exc.message}) from exc

    response: dict = {
        "status": "ok",
        "telegram_username": username,
        "delivery": "telegram",
    }
    if settings.app_debug:
        response["dev_otp"] = otp
    return response
