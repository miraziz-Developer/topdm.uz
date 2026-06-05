from __future__ import annotations

import base64
import time
from typing import Any
from uuid import UUID

from fastapi import HTTPException, Request

from app.core.config import Settings, get_settings


PAYME_ERRORS: dict[int, dict[str, Any]] = {
    -31050: {"ru": "Mahsulot topilmadi", "uz": "Buyurtma topilmadi", "en": "Order not found"},
    -31051: {"ru": "Неверная сумма", "uz": "Summa noto'g'ri", "en": "Invalid amount"},
    -31052: {"ru": "Транзакция не найдена", "uz": "Tranzaksiya topilmadi", "en": "Transaction not found"},
    -31008: {"ru": "Невозможно выполнить операцию", "uz": "Amalni bajarib bo'lmadi", "en": "Cannot perform"},
    -32504: {"ru": "Недостаточно привилегий", "uz": "Ruxsat yo'q", "en": "Unauthorized"},
}


def assert_payme_basic_auth(request: Request, settings: Settings | None = None) -> None:
    cfg = settings or get_settings()
    secret = (
        (cfg.payment_sandbox_payme_secret_key or "").strip()
        if cfg.payment_sandbox_mode
        else (cfg.payme_secret_key or "").strip()
    )
    if not secret:
        if cfg.app_debug and not cfg.is_production:
            return
        raise HTTPException(status_code=403, detail="payme_not_configured")

    header = request.headers.get("authorization", "")
    if not header.lower().startswith("basic "):
        raise HTTPException(status_code=403, detail="payme_auth_required")

    try:
        decoded = base64.b64decode(header.split(" ", 1)[1]).decode("utf-8")
    except Exception as exc:
        raise HTTPException(status_code=403, detail="payme_auth_invalid") from exc

    login, _, password = decoded.partition(":")
    if login != "Paycom" or password != secret:
        raise HTTPException(status_code=403, detail="payme_auth_invalid")


def payme_error(code: int, *, message_uz: str | None = None) -> dict[str, Any]:
    data = PAYME_ERRORS.get(code, {"uz": message_uz or "Xato", "ru": "Ошибка", "en": "Error"})
    if message_uz:
        data = {**data, "uz": message_uz}
    return {"code": code, "message": data}


def payme_result(request_id: int | str | None, result: dict[str, Any]) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def payme_rpc_error(request_id: int | str | None, code: int, *, message_uz: str | None = None) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": payme_error(code, message_uz=message_uz)}


def parse_payme_account(account: dict[str, Any]) -> UUID:
    """Payme checkout account: order_id or checkout_id."""
    raw = str(account.get("order_id") or account.get("checkout_id") or account.get("order") or "").strip()
    return UUID(raw)


def payme_time_ms() -> int:
    return int(time.time() * 1000)


def assert_payme_request_fresh(body: dict[str, Any], settings: Settings | None = None) -> None:
    cfg = settings or get_settings()
    params = body.get("params") if isinstance(body, dict) else None
    if not isinstance(params, dict):
        raise HTTPException(status_code=400, detail="payme_invalid_params")
    raw = params.get("time")
    if raw is None:
        raise HTTPException(status_code=400, detail="payme_missing_time")
    try:
        request_ms = int(raw)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="payme_invalid_time") from exc
    now_ms = payme_time_ms()
    max_age_ms = max(30, int(cfg.payment_callback_max_age_seconds)) * 1000
    if abs(now_ms - request_ms) > max_age_ms:
        raise HTTPException(status_code=408, detail="payme_request_expired")
