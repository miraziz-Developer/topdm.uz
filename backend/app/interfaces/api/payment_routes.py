from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.payments.click_verify import is_click_sign_time_fresh
from app.application.payments.gateway_security import assert_payment_callback_ip
from app.application.payments.order_payment_service import OrderPaymentService
from app.application.payments.payme_merchant_api import assert_payme_basic_auth, assert_payme_request_fresh
from app.application.payments.service import PaymentService
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
async def click_payment_callback(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Click.uz webhook: IP whitelist + MD5 signature + idempotent coin credit."""
    assert_payment_callback_ip(request)
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="invalid_json") from exc
    if not is_click_sign_time_fresh(payload):
        raise HTTPException(status_code=408, detail="callback_request_expired")

    service = OrderPaymentService(db)
    try:
        return await service.process_click_callback(payload)
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
async def payme_payment_callback(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Payme Merchant API (JSON-RPC 2.0) — buyurtma to'lovi."""
    assert_payment_callback_ip(request)
    assert_payme_basic_auth(request)
    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="invalid_json") from exc
    assert_payme_request_fresh(body)

    service = OrderPaymentService(db)
    try:
        return await service.handle_payme_rpc(body)
    except Exception:
        await db.rollback()
        req_id = body.get("id") if isinstance(body, dict) else None
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "error": {"code": -32400, "message": {"uz": "Ichki xato", "ru": "Внутренняя ошибка", "en": "Internal error"}},
        }
