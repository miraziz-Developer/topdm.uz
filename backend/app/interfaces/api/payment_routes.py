from __future__ import annotations

import hashlib
import time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.payments.click_verify import build_click_sign_string, is_click_sign_time_fresh
from app.application.payments.gateway_security import assert_payment_callback_ip
from app.application.payments.order_payment_service import OrderPaymentService
from app.application.payments.payment_gateway_service import PaymentGatewayService
from app.application.payments.payme_merchant_api import assert_payme_basic_auth, assert_payme_request_fresh
from app.application.payments.service import PaymentService
from app.core.config import get_settings
from app.interfaces.api.admin_routes import require_admin_key
from app.infrastructure.auth.deps import require_merchant
from app.infrastructure.auth.merchant_resolve import resolve_merchant_shop
from app.infrastructure.auth.types import AuthUser
from app.infrastructure.db.session import get_db_session

router = APIRouter(prefix="/payments", tags=["payments"])


async def _merchant_shop_id(
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> UUID:
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    return shop.id


class GenerateInvoiceBody(BaseModel):
    shop_id: UUID | None = None
    coin_package_id: UUID
    provider: str = Field(..., pattern="^(click|payme|manual)$")


class SandboxClickBody(BaseModel):
    merchant_trans_id: UUID
    amount_uzs: int = Field(..., ge=1_000)
    click_trans_id: str = Field(default="sandbox-click-tx")
    action: int = Field(default=1)
    error: int = Field(default=0)


class SandboxPaymeBody(BaseModel):
    checkout_or_order_id: UUID
    amount_uzs: int = Field(..., ge=1_000)
    payme_trans_id: str = Field(default="sandbox-payme-tx")


@router.get("/coin-packages")
async def list_coin_packages(db: AsyncSession = Depends(get_db_session)) -> dict:
    service = PaymentService(db)
    return {"items": await service.list_coin_packages()}


@router.post("/generate-invoice")
async def generate_invoice(
    body: GenerateInvoiceBody,
    auth_shop_id: UUID = Depends(_merchant_shop_id),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop_id = body.shop_id or auth_shop_id
    if shop_id != auth_shop_id:
        raise HTTPException(status_code=403, detail="Shop access denied")

    service = PaymentService(db)
    try:
        return await service.generate_invoice(
            shop_id=shop_id,
            coin_package_id=body.coin_package_id,
            provider=body.provider,
        )
    except ValueError as exc:
        code = str(exc)
        status = 404 if code == "package_not_found" else 400
        raise HTTPException(status_code=status, detail=code) from exc


@router.post("/callback/click")
@router.post("/click/webhook")
async def click_payment_callback(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Click.uz webhook: IP whitelist + MD5 signature + idempotent settlement."""
    assert_payment_callback_ip(request)
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="invalid_json") from exc
    if not is_click_sign_time_fresh(payload):
        raise HTTPException(status_code=408, detail="callback_request_expired")

    gateway = PaymentGatewayService(db)
    try:
        return await gateway.process_click_webhook(payload)
    except ValueError as exc:
        code = str(exc)
        if code == "invalid_signature":
            raise HTTPException(status_code=403, detail=code) from exc
        if code == "payment_not_successful":
            return {
                "error": -9,
                "error_note": "Payment declined",
                "click_trans_id": payload.get("click_trans_id"),
                "merchant_trans_id": payload.get("merchant_trans_id"),
            }
        await db.rollback()
        return {"error": -8, "error_note": code, "merchant_trans_id": payload.get("merchant_trans_id")}
    except Exception:
        await db.rollback()
        return {"error": -8, "error_note": "internal_error"}


@router.post("/callback/payme")
@router.post("/payme/webhook")
async def payme_payment_callback(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Payme Merchant API (JSON-RPC 2.0) — buyurtma va qarz to'lovi."""
    assert_payment_callback_ip(request)
    assert_payme_basic_auth(request)
    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="invalid_json") from exc
    assert_payme_request_fresh(body)

    gateway = PaymentGatewayService(db)
    try:
        return await gateway.process_payme_webhook(body)
    except Exception:
        await db.rollback()
        req_id = body.get("id") if isinstance(body, dict) else None
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "error": {"code": -32400, "message": {"uz": "Ichki xato", "ru": "Внутренняя ошибка", "en": "Internal error"}},
        }


@router.post("/sandbox/click/simulate")
async def sandbox_click_simulate(
    body: SandboxClickBody,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    settings = get_settings()
    if not settings.payment_sandbox_mode:
        raise HTTPException(status_code=403, detail="payment_sandbox_mode_disabled")

    sign_time = str(int(time.time()))
    click_trans_id = body.click_trans_id or f"sandbox-click-{int(time.time())}"
    sign = hashlib.md5(
        build_click_sign_string(
            click_trans_id=click_trans_id,
            service_id=settings.payment_sandbox_click_service_id,
            secret_key=settings.payment_sandbox_click_secret_key,
            merchant_trans_id=str(body.merchant_trans_id),
            amount=str(body.amount_uzs),
            action=str(body.action),
            sign_time=sign_time,
        ).encode("utf-8")
    ).hexdigest()
    payload = {
        "click_trans_id": click_trans_id,
        "merchant_trans_id": str(body.merchant_trans_id),
        "amount": str(body.amount_uzs),
        "action": body.action,
        "error": body.error,
        "sign_time": sign_time,
        "sign_string": sign,
    }

    service = OrderPaymentService(db)
    return await service.process_click_callback(payload)


@router.post("/sandbox/payme/simulate")
async def sandbox_payme_simulate(
    body: SandboxPaymeBody,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    settings = get_settings()
    if not settings.payment_sandbox_mode:
        raise HTTPException(status_code=403, detail="payment_sandbox_mode_disabled")

    req_time = int(time.time() * 1000)
    rpc_body = {
        "jsonrpc": "2.0",
        "id": "sandbox-payme",
        "method": "PerformTransaction",
        "params": {
            "id": body.payme_trans_id,
            "time": req_time,
            "amount": int(body.amount_uzs) * 100,
            "account": {"checkout_id": str(body.checkout_or_order_id)},
        },
    }
    assert_payme_request_fresh(rpc_body, settings=settings)

    service = OrderPaymentService(db)
    return await service.handle_payme_rpc(rpc_body)
