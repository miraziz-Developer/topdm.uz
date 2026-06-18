"""Click.uz SHOP API — Prepare (0) va Complete (1).

Hujjat: https://docs.click.uz/en/click-api-request/
"""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import Request

from app.application.payments.click_verify import verify_click_callback
from app.core.config import Settings, get_settings

# Click SHOP API error codes
CLICK_OK = 0
CLICK_SIGN_FAILED = -1
CLICK_INVALID_AMOUNT = -2
CLICK_ACTION_NOT_FOUND = -3
CLICK_ALREADY_PAID = -4
CLICK_USER_NOT_FOUND = -5
CLICK_TRANSACTION_NOT_FOUND = -6
CLICK_UPDATE_FAILED = -7
CLICK_BAD_REQUEST = -8
CLICK_CANCELLED = -9


def stable_prepare_id(target_id: UUID) -> int:
    """Click merchant_prepare_id — int, barqaror UUID dan."""
    return int.from_bytes(target_id.bytes[:4], byteorder="big") % 2_000_000_000 or 1


def parse_click_payload(raw: dict[str, Any]) -> dict[str, Any]:
    """Normalize form/query fields to strings Click handler expects."""
    out: dict[str, Any] = {}
    for key, value in raw.items():
        if value is None:
            continue
        out[str(key)] = value if isinstance(value, (int, float)) else str(value).strip()
    return out


async def read_click_request_payload(request: Request) -> dict[str, Any]:
    content_type = (request.headers.get("content-type") or "").lower()
    if "application/json" in content_type:
        data = await request.json()
        return parse_click_payload(data if isinstance(data, dict) else {})
    if "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        form = await request.form()
        return parse_click_payload({k: form.get(k) for k in form.keys()})
    # Click kabineti ba'zan query string yuboradi
    if request.query_params:
        return parse_click_payload(dict(request.query_params))
    try:
        data = await request.json()
        return parse_click_payload(data if isinstance(data, dict) else {})
    except Exception:
        return {}


def click_response(
    *,
    click_trans_id: str,
    merchant_trans_id: str,
    error: int,
    error_note: str,
    merchant_prepare_id: int | None = None,
    merchant_confirm_id: int | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "click_trans_id": click_trans_id,
        "merchant_trans_id": merchant_trans_id,
        "error": error,
        "error_note": error_note,
    }
    if merchant_prepare_id is not None:
        body["merchant_prepare_id"] = merchant_prepare_id
    if merchant_confirm_id is not None:
        body["merchant_confirm_id"] = merchant_confirm_id
    return body


def verify_click_shop_signature(payload: dict[str, Any], settings: Settings | None = None) -> bool:
    return verify_click_callback(payload, settings)


def parse_merchant_trans_id(payload: dict[str, Any]) -> UUID | None:
    raw = str(payload.get("merchant_trans_id") or "").strip()
    if not raw:
        return None
    try:
        return UUID(raw)
    except ValueError:
        return None


def click_amount_uzs(payload: dict[str, Any]) -> int:
    raw = str(payload.get("amount") or "0").replace(",", ".")
    try:
        return int(float(raw))
    except ValueError:
        return 0


def is_sign_time_acceptable(payload: dict[str, Any], settings: Settings | None = None) -> bool:
    """Click sign_time: YYYY-MM-DD HH:mm:ss yoki unix timestamp."""
    cfg = settings or get_settings()
    raw = str(payload.get("sign_time") or "").strip()
    if not raw:
        return False
    max_age = max(30, int(cfg.payment_callback_max_age_seconds))
    now = datetime.utcnow()
    if raw.isdigit():
        try:
            ts = int(raw)
            delta = abs(int(datetime.utcnow().timestamp()) - ts)
            return delta <= max_age
        except ValueError:
            return False
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d+%H:%M:%S"):
        try:
            parsed = datetime.strptime(raw.replace("+", " "), fmt)
            delta = abs((now - parsed).total_seconds())
            return delta <= max_age
        except ValueError:
            continue
    return True
