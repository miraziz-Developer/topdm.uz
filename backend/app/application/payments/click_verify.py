from __future__ import annotations

import hashlib
import hmac
from datetime import datetime
from typing import Any

from app.core.config import Settings, get_settings


def _click_credentials(settings: Settings) -> tuple[str, str]:
    if settings.payment_sandbox_mode:
        return (
            (settings.payment_sandbox_click_service_id or "").strip(),
            (settings.payment_sandbox_click_secret_key or "").strip(),
        )
    return (
        (settings.click_service_id or "").strip(),
        (settings.click_secret_key or "").strip(),
    )


def build_click_sign_string(
    *,
    click_trans_id: str,
    service_id: str,
    secret_key: str,
    merchant_trans_id: str,
    amount: str,
    action: str,
    sign_time: str,
    merchant_prepare_id: str | None = None,
) -> str:
    """
    Prepare (action=0): 7 fields — trans + service + secret + merchant + amount + action + time
    Complete (action=1): 8 fields — ... + merchant_prepare_id before amount
    https://docs.click.uz/en/click-api-request/
    """
    action_int = int(action)
    if action_int == 1:
        return (
            f"{click_trans_id}{service_id}{secret_key}{merchant_trans_id}"
            f"{merchant_prepare_id or ''}{amount}{action}{sign_time}"
        )
    return (
        f"{click_trans_id}{service_id}{secret_key}{merchant_trans_id}"
        f"{amount}{action}{sign_time}"
    )


def verify_click_callback(payload: dict[str, Any], settings: Settings | None = None) -> bool:
    """Validate Click.uz SHOP API prepare/complete callback signature (MD5)."""
    cfg = settings or get_settings()
    secret = _click_credentials(cfg)[1]
    service_id = _click_credentials(cfg)[0]
    if not secret or not service_id:
        return cfg.app_debug and not cfg.is_production

    click_trans_id = str(payload.get("click_trans_id", ""))
    merchant_trans_id = str(payload.get("merchant_trans_id", ""))
    amount = str(payload.get("amount", ""))
    action = str(payload.get("action", ""))
    sign_time = str(payload.get("sign_time", ""))
    sign_string = str(payload.get("sign_string", ""))
    merchant_prepare_id = str(payload.get("merchant_prepare_id") or "")

    if not all([click_trans_id, merchant_trans_id, amount, sign_time, sign_string, action]):
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
            merchant_prepare_id=merchant_prepare_id if int(action or "0") == 1 else None,
        ).encode("utf-8"),
    ).hexdigest()
    return hmac.compare_digest(digest, sign_string)


def is_click_sign_time_fresh(payload: dict[str, Any], settings: Settings | None = None) -> bool:
    cfg = settings or get_settings()
    raw = str(payload.get("sign_time", "")).strip()
    if not raw:
        return False
    max_age = max(30, int(cfg.payment_callback_max_age_seconds))
    now_ts = int(datetime.utcnow().timestamp())

    if raw.isdigit():
        try:
            sign_time = int(raw)
            return abs(now_ts - sign_time) <= max_age
        except ValueError:
            return False

    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d+%H:%M:%S"):
        try:
            parsed = datetime.strptime(raw.replace("+", " "), fmt)
            return abs(now_ts - int(parsed.timestamp())) <= max_age
        except ValueError:
            continue
    return False
