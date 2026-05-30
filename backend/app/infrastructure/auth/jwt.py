from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from jose import jwt

from app.core.config import get_settings


def create_access_token(
    *,
    subject: str,
    role: str = "consumer",
    shop_id: UUID | None = None,
    email: str | None = None,
    phone: str | None = None,
    telegram_id: int | None = None,
) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=settings.jwt_exp_minutes)
    payload: dict[str, object] = {
        "sub": subject,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    if shop_id is not None:
        payload["shop_id"] = str(shop_id)
    if email:
        payload["email"] = email
    if phone:
        payload["phone"] = phone
    if telegram_id is not None:
        payload["telegram_id"] = telegram_id
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
