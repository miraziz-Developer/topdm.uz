from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any
from urllib.parse import parse_qsl


def _telegram_field_value(value: Any) -> str:
    """Telegram hash — barcha qiymatlar string sifatida."""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def verify_telegram_login(data: dict[str, Any], bot_token: str, *, max_age_seconds: int = 86_400) -> bool:
    """Validate Telegram Login Widget payload (https://core.telegram.org/widgets/login)."""
    payload = {k: v for k, v in data.items() if v is not None and k != "hash"}
    received_hash = str(data.get("hash") or "")
    if not received_hash or not bot_token:
        return False

    try:
        auth_date = int(payload.get("auth_date") or 0)
    except (TypeError, ValueError):
        return False
    if auth_date and time.time() - auth_date > max_age_seconds:
        return False

    check_string = "\n".join(
        f"{k}={_telegram_field_value(payload[k])}" for k in sorted(payload.keys())
    )
    secret = hashlib.sha256(bot_token.encode()).digest()
    computed = hmac.HMAC(secret, check_string.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, received_hash)


def verify_telegram_webapp_init_data(
    init_data: str,
    bot_token: str,
    *,
    max_age_seconds: int = 86_400,
) -> dict[str, str] | None:
    """Validate Telegram Mini App initData (https://core.telegram.org/bots/webapps#validating-data)."""
    raw = (init_data or "").strip()
    if not raw or not bot_token:
        return None

    parsed = dict(parse_qsl(raw, keep_blank_values=True))
    received_hash = parsed.pop("hash", None)
    if not received_hash:
        return None

    auth_date = int(parsed.get("auth_date") or 0)
    if auth_date and time.time() - auth_date > max_age_seconds:
        return None

    check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
    secret = hmac.HMAC(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    calculated = hmac.HMAC(secret, check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calculated, received_hash):
        return None
    return parsed


def parse_webapp_user(init_data: str, bot_token: str) -> dict[str, Any] | None:
    """Return Telegram user dict from validated WebApp initData."""
    parsed = verify_telegram_webapp_init_data(init_data, bot_token)
    if not parsed:
        return None
    user_raw = parsed.get("user")
    if not user_raw:
        return None
    try:
        user = json.loads(user_raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(user, dict) or not user.get("id"):
        return None
    return user
