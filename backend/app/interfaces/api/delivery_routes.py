from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.delivery.delivery_checkout_service import DeliveryCheckoutService
from app.application.delivery.delivery_dispatch_service import DeliveryDispatchService
from app.infrastructure.auth.deps import require_merchant
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
    except ValueError as exc:
        code = str(exc)
        status = 400
        if code == "product_not_found":
            status = 404
        raise HTTPException(status_code=status, detail=code) from exc


@router.post("/orders/reserve-delivery")
async def reserve_delivery_order(
    payload: DeliveryReserveRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
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
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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

    wallet = await db.get(MerchantFinanceWalletModel, shop.id)
    available = wallet.current_balance if wallet else Decimal("0")
    amount = Decimal(str(body.amount_uzs)).quantize(Decimal("0.01"))
    if amount > available:
        raise HTTPException(status_code=400, detail="insufficient_balance")

    repo = DeliveryRepository(db)
    row = await repo.create_payout_request(
        shop_id=shop.id,
        amount_uzs=amount,
        destination=body.destination,
    )
    await db.commit()
    return {
        "payout_id": str(row.id),
        "amount_uzs": float(amount),
        "status": row.status,
        "wallet": await repo.get_wallet_summary(shop.id),
    }
