from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from loguru import logger
from pydantic import ValidationError

from app.application.delivery.delivery_checkout_service import DeliveryCheckoutService
from app.services.inventory import InventoryError
from app.application.delivery.delivery_dispatch_service import DeliveryDispatchService
from app.application.delivery.bts_delivery import BtsDeliveryError
from app.infrastructure.delivery.bts_client import BtsDeliveryAPIError
from app.interfaces.api.order_reservation_routes import assert_guest_phone_verified
from app.core.phone import normalize_uz_phone_e164
from app.infrastructure.auth.deps import get_optional_user, require_merchant
from app.infrastructure.auth.merchant_resolve import resolve_merchant_shop
from app.infrastructure.auth.types import AuthUser
from app.infrastructure.db.session import get_db_session
from app.infrastructure.repositories.delivery_repo import DeliveryRepository
from app.models.finance import MerchantFinanceWalletModel
from app.schemas.delivery import DeliveryQuoteRequest, DeliveryReserveRequest, MerchantPayoutRequestBody

router = APIRouter(tags=["delivery"])


@router.post("/delivery/quote")
async def quote_delivery(
    payload: DeliveryQuoteRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = DeliveryCheckoutService(db)
    try:
        return await service.quote_cart(
            items=[i.model_dump() for i in payload.items],
            customer_phone=payload.user_phone,
            destination_address=payload.destination_address,
            destination_lat=payload.destination_lat,
            destination_lng=payload.destination_lng,
            destination_city=payload.destination_city,
        )
    except (ValueError, BtsDeliveryError) as exc:
        code = str(exc)
        status = 400
        if code == "product_not_found":
            status = 404
        raise HTTPException(status_code=status, detail=code) from exc
    except BtsDeliveryAPIError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValidationError as exc:
        logger.warning("delivery_quote_validation_error: {}", exc)
        raise HTTPException(status_code=400, detail="invalid_product_dimensions") from exc


@router.post("/orders/reserve-delivery")
async def reserve_delivery_order(
    payload: DeliveryReserveRequest,
    user: AuthUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    # Mehmon (login'siz) bo'lsa telefon OTP bilan tasdiqlangan bo'lishi shart
    if user is None:
        phone = normalize_uz_phone_e164(payload.user_phone) or payload.user_phone.strip()
        await assert_guest_phone_verified(phone, payload.verification_token)
    service = DeliveryCheckoutService(db)
    try:
        return await service.reserve_delivery_order(
            items=[i.model_dump() for i in payload.items],
            customer_phone=payload.user_phone,
            customer_email=payload.user_email,
            payment_method=payload.payment_method.value,
            note=payload.note,
            ref_token=payload.ref_token,
            destination_address=payload.destination_address,
            destination_lat=payload.destination_lat,
            destination_lng=payload.destination_lng,
            destination_city=payload.destination_city,
            carrier_class=payload.carrier_class,
            delivery_cost_uzs=payload.delivery_cost_uzs,
            delivery_eta_minutes=payload.delivery_eta_minutes,
            offer_payload=payload.offer_payload,
            customer_user_id=user.id if user is not None else None,
        )
    except InventoryError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        code = str(exc)
        if code == "online_checkout_failed":
            raise HTTPException(
                status_code=503,
                detail="Onlayn to'lov sessiyasi yaratilmadi. Naqd/terminal tanlang yoki qayta urinib ko'ring.",
            ) from exc
        raise HTTPException(status_code=400, detail=code) from exc


@router.post("/merchant/orders/{order_id}/dispatch-courier")
async def merchant_dispatch_courier(
    order_id: UUID,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    service = DeliveryDispatchService(db)
    try:
        return await service.dispatch_order_to_courier(shop_id=shop.id, order_id=order_id)
    except ValueError as exc:
        code = str(exc)
        status = 404 if "not_found" in code else 400
        raise HTTPException(status_code=status, detail=code) from exc


@router.get("/merchant/orders/{order_id}/waybill")
async def merchant_order_waybill(
    order_id: UUID,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    service = DeliveryDispatchService(db)
    try:
        return await service.get_waybill(shop_id=shop.id, order_id=order_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/merchant/orders/{order_id}/sync-delivery")
async def merchant_sync_delivery_status(
    order_id: UUID,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    service = DeliveryDispatchService(db)
    try:
        return await service.sync_claim_status(shop_id=shop.id, order_id=order_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/delivery/callback/bts")
async def bts_delivery_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """BTS webhook — buyurtma status yangilanishi."""
    from app.core.config import get_settings

    settings = get_settings()
    secret = (settings.bts_webhook_secret or "").strip()
    if not secret:
        if settings.is_production:
            raise HTTPException(status_code=503, detail="bts_webhook_not_configured")
    else:
        token = request.headers.get("x-bts-token") or request.headers.get("authorization", "")
        if token.lower().startswith("bearer "):
            token = token.split(" ", 1)[1]
        if token != secret:
            raise HTTPException(status_code=403, detail="invalid_webhook_token")

    try:
        if "application/json" in (request.headers.get("content-type") or "").lower():
            payload = await request.json()
        else:
            form = await request.form()
            payload = {k: form.get(k) for k in form.keys()}
    except Exception as exc:
        raise HTTPException(status_code=400, detail="invalid_payload") from exc

    order_id_raw = (
        str(payload.get("orderId") or payload.get("order_id") or payload.get("clientId") or "")
    ).strip()
    if not order_id_raw:
        return {"ok": False, "reason": "order_id_missing"}

    from app.infrastructure.repositories.delivery_repo import DeliveryRepository
    from app.application.delivery.bts_delivery import BtsDeliveryService

    repo = DeliveryRepository(db)
    try:
        order_uuid = UUID(order_id_raw)
    except ValueError:
        return {"ok": False, "reason": "invalid_order_id"}

    claim = await repo.get_claim_by_order_for_update(order_uuid)
    if not claim:
        return {"ok": False, "reason": "claim_not_found"}

    status_name = str(payload.get("status") or payload.get("status_name") or "")
    status_code = str(payload.get("status_code") or "")
    mapped = BtsDeliveryService.map_bts_status_to_claim(status_code=status_code, status_name=status_name)
    delivered = mapped == "delivered"
    await repo.update_claim_status(claim, status=mapped, delivered=delivered)
    if delivered:
        from app.application.delivery.bundle_completion import complete_delivery_bundle

        await complete_delivery_bundle(db, claim=claim)
    await db.commit()
    return {"ok": True, "status": mapped}


@router.get("/merchant/finance/wallet")
async def merchant_finance_wallet(
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    repo = DeliveryRepository(db)
    return {"shop_id": str(shop.id), "wallet": await repo.get_wallet_summary(shop.id)}


@router.post("/merchant/finance/payout-request")
async def merchant_request_payout(
    body: MerchantPayoutRequestBody,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=403, detail="Merchant shop not found")

    from sqlalchemy import select

    amount = Decimal(str(body.amount_uzs)).quantize(Decimal("0.01"))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="invalid_amount")

    wallet_row = await db.execute(
        select(MerchantFinanceWalletModel)
        .where(MerchantFinanceWalletModel.shop_id == shop.id)
        .with_for_update()
    )
    wallet = wallet_row.scalar_one_or_none()
    available = wallet.current_balance if wallet else Decimal("0")
    if amount > available:
        raise HTTPException(status_code=400, detail="insufficient_balance")

    if wallet:
        wallet.current_balance = available - amount
        wallet.frozen_balance = (wallet.frozen_balance or Decimal("0")) + amount

    repo = DeliveryRepository(db)
    row = await repo.create_payout_request(
        shop_id=shop.id,
        amount_uzs=amount,
        destination=body.destination,
        card_number=body.card_number,
    )
    await db.commit()
    return {
        "payout_id": str(row.id),
        "amount_uzs": float(amount),
        "status": row.status,
        "wallet": await repo.get_wallet_summary(shop.id),
    }
