from __future__ import annotations

import hashlib
import time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.payments.click_shop_api import (
    CLICK_BAD_REQUEST,
    CLICK_SIGN_FAILED,
    click_response,
    is_sign_time_acceptable,
    read_click_request_payload,
    stable_prepare_id,
)
from app.application.payments.click_verify import build_click_sign_string
from app.application.payments.gateway_security import assert_payment_callback_ip
from app.application.payments.order_payment_service import OrderPaymentService
from app.application.payments.payment_gateway_service import PaymentGatewayService
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
    provider: str = Field(..., pattern="^(click|manual)$")


class SandboxClickBody(BaseModel):
    merchant_trans_id: UUID
    amount_uzs: int = Field(..., ge=1_000)
    click_trans_id: str = Field(default="sandbox-click-tx")
    action: int = Field(default=1)
    error: int = Field(default=0)


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


async def _handle_click_shop_request(
    request: Request,
    db: AsyncSession,
    *,
    forced_action: int | None = None,
) -> dict:
    """Click SHOP API — form-urlencoded, JSON yoki query; Prepare (0) / Complete (1)."""
    assert_payment_callback_ip(request)
    payload = await read_click_request_payload(request)
    if not payload:
        return click_response(
            click_trans_id="",
            merchant_trans_id="",
            error=CLICK_BAD_REQUEST,
            error_note="Empty request",
        )
    if forced_action is not None:
        payload["action"] = forced_action
    if not is_sign_time_acceptable(payload):
        return click_response(
            click_trans_id=str(payload.get("click_trans_id") or ""),
            merchant_trans_id=str(payload.get("merchant_trans_id") or ""),
            error=CLICK_SIGN_FAILED,
            error_note="SIGN TIME EXPIRED",
        )

    gateway = PaymentGatewayService(db)
    try:
        return await gateway.process_click_webhook(payload)
    except Exception:
        await db.rollback()
        return click_response(
            click_trans_id=str(payload.get("click_trans_id") or ""),
            merchant_trans_id=str(payload.get("merchant_trans_id") or ""),
            error=CLICK_BAD_REQUEST,
            error_note="internal_error",
        )


@router.post("/callback/click")
@router.post("/click/webhook")
async def click_payment_callback(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    return await _handle_click_shop_request(request, db)


@router.post("/click/prepare")
async def click_prepare_callback(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Click kabineti uchun alohida Prepare URL (action=0)."""
    return await _handle_click_shop_request(request, db, forced_action=0)


@router.post("/click/complete")
async def click_complete_callback(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Click kabineti uchun alohida Complete URL (action=1)."""
    return await _handle_click_shop_request(request, db, forced_action=1)


@router.post("/sandbox/complete-checkout")
async def sandbox_complete_checkout(
    checkout_id: UUID,
    provider: str = "click",
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Test to'lov — faqat PAYMENT_SANDBOX_MODE=true va admin kalit bilan."""
    settings = get_settings()
    if not settings.payment_sandbox_mode:
        raise HTTPException(status_code=403, detail="payment_sandbox_mode_disabled")

    from app.infrastructure.repositories.order_payment_repo import OrderPaymentRepository

    repo = OrderPaymentRepository(db)
    checkout = await repo.get_checkout(checkout_id)
    if not checkout:
        raise HTTPException(status_code=404, detail="checkout_not_found")
    if str(checkout.status or "") != "pending":
        raise HTTPException(status_code=400, detail="checkout_not_pending")

    prov = provider.strip().lower()
    amount = int(checkout.amount_uzs)
    if prov == "click":
        sign_time = str(int(time.time()))
        click_trans_id = f"sandbox-customer-{int(time.time())}"
        prepare_id = str(stable_prepare_id(checkout_id))
        sign = hashlib.md5(
            build_click_sign_string(
                click_trans_id=click_trans_id,
                service_id=settings.payment_sandbox_click_service_id,
                secret_key=settings.payment_sandbox_click_secret_key,
                merchant_trans_id=str(checkout_id),
                amount=str(amount),
                action="1",
                sign_time=sign_time,
                merchant_prepare_id=prepare_id,
            ).encode("utf-8")
        ).hexdigest()
        payload = {
            "click_trans_id": click_trans_id,
            "merchant_trans_id": str(checkout_id),
            "amount": str(amount),
            "action": 1,
            "error": 0,
            "sign_time": sign_time,
            "sign_string": sign,
            "merchant_prepare_id": prepare_id,
        }
        service = OrderPaymentService(db)
        result = await service.process_click_callback(payload)
        await db.commit()
        return {"status": "ok", "provider": "click", "result": result}

    raise HTTPException(status_code=400, detail="invalid_provider")


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
    prepare_id = str(stable_prepare_id(body.merchant_trans_id))
    sign = hashlib.md5(
        build_click_sign_string(
            click_trans_id=click_trans_id,
            service_id=settings.payment_sandbox_click_service_id,
            secret_key=settings.payment_sandbox_click_secret_key,
            merchant_trans_id=str(body.merchant_trans_id),
            amount=str(body.amount_uzs),
            action=str(body.action),
            sign_time=sign_time,
            merchant_prepare_id=prepare_id if body.action == 1 else None,
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
    if body.action == 1:
        payload["merchant_prepare_id"] = prepare_id

    service = OrderPaymentService(db)
    return await service.process_click_callback(payload)


@router.post("/sandbox/click/refund")
async def sandbox_click_refund(
    order_id: UUID,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Sandbox Click qaytarish — PAYMENT_SANDBOX_MODE + admin kalit."""
    settings = get_settings()
    if not settings.payment_sandbox_mode:
        raise HTTPException(status_code=403, detail="payment_sandbox_mode_disabled")

    from app.application.payments.order_refund_service import OrderRefundService
    from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository

    repo = MarketplaceRepository(db)
    order = await repo.get_order_by_id(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="order_not_found")

    result = await OrderRefundService(db).refund_cancelled_order(order)
    await db.commit()
    return {"status": "ok", "refund": result}
