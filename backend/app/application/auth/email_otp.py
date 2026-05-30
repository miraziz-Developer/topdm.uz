from __future__ import annotations

import random

from fastapi import BackgroundTasks, HTTPException

from app.core.config import get_settings
from app.infrastructure.messaging.resend_email import (
    ResendEmailError,
    normalize_email,
    resend_email_gateway,
    send_otp_email_background,
)


async def issue_and_send_email_otp(
    *,
    email: str,
    background_tasks: BackgroundTasks | None = None,
    link_user_id: str | None = None,
) -> dict:
    settings = get_settings()
    if not settings.resend_api_key:
        raise HTTPException(
            status_code=503,
            detail="RESEND_API_KEY sozlanmagan",
        )

    normalized = normalize_email(email)
    otp = f"{random.randint(1000, 9999)}"

    try:
        if background_tasks is not None:
            await resend_email_gateway.store_otp(to_email=normalized, otp=otp, link_user_id=link_user_id)
            background_tasks.add_task(send_otp_email_background, to_email=normalized, otp=otp)
        else:
            await resend_email_gateway.send_otp(to_email=normalized, otp=otp, link_user_id=link_user_id)
    except ResendEmailError as exc:
        status = 503 if exc.code in {"resend_not_configured", "resend_unreachable"} else 400
        raise HTTPException(status_code=status, detail=exc.message) from exc

    response: dict = {
        "status": "ok",
        "email": normalized,
        "delivery": "resend",
    }
    if settings.app_debug:
        response["dev_otp"] = otp
    return response
