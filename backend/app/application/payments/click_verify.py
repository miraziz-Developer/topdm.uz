from __future__ import annotations

import hashlib
import hmac
import time
from typing import Any

from app.core.config import Settings, get_settings


def build_click_sign_string(
    *,
    click_trans_id: str,
    service_id: str,
    secret_key: str,
    merchant_trans_id: str,
    amount: str,
    action: str,
    sign_time: str,
) -> str:
    return (
        f"{click_trans_id}{service_id}{secret_key}{merchant_trans_id}"
        f"{amount}{action}{sign_time}"
    )


def verify_click_callback(payload: dict[str, Any], settings: Settings | None = None) -> bool:
    """Validate Click.uz prepare/complete callback signature (MD5)."""
    cfg = settings or get_settings()
    if cfg.payment_sandbox_mode:
        secret = (cfg.payment_sandbox_click_secret_key or "").strip()
        service_id = (cfg.payment_sandbox_click_service_id or "").strip()
    else:
        secret = (cfg.click_secret_key or "").strip()
        service_id = (cfg.click_service_id or "").strip()
    if not secret or not service_id:
        return cfg.app_debug and not cfg.is_production

    click_trans_id = str(payload.get("click_trans_id", ""))
    merchant_trans_id = str(payload.get("merchant_trans_id", ""))
    amount = str(payload.get("amount", ""))
    action = str(payload.get("action", ""))
    sign_time = str(payload.get("sign_time", ""))
    sign_string = str(payload.get("sign_string", ""))

    if not all([click_trans_id, merchant_trans_id, amount, sign_time, sign_string]):
        return False

    digest = hashlib.md5(
        build_click_sign_string(
            click_trans_id=click_trans_id,
            service_id=service_id,
            secret_key=secret,
            merchant_trans_id=merchant_trans_id,
            amount=amount,
            action=action,
            sign_time=sign_time,
        ).encode("utf-8"),
    ).hexdigest()
    return hmac.compare_digest(digest, sign_string)


def is_click_sign_time_fresh(payload: dict[str, Any], settings: Settings | None = None) -> bool:
    cfg = settings or get_settings()
    raw = str(payload.get("sign_time", "")).strip()
    if not raw:
        return False
    try:
        sign_time = int(raw)
    except ValueError:
        return False
    now = int(time.time())
    max_age = max(30, int(cfg.payment_callback_max_age_seconds))
    return abs(now - sign_time) <= max_age
