from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.session import get_db_session
from src.models.bazaar import ChannelSource, MerchantProfile, OrderClaim, OrderClaimStatus
from src.services.yandex_delivery import GeoPoint, YandexDeliveryGateway

router = APIRouter(prefix="/api/v1", tags=["orders-v1-unified"])


class CartItem(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(ge=1, le=1000)
    unit_weight_kg: float = Field(gt=0, le=1000)
    unit_volume_m3: float = Field(gt=0, le=10)


class CheckoutRequest(BaseModel):
    client_id: uuid.UUID
    merchant_id: uuid.UUID
    customer_phone: str = Field(min_length=7, max_length=32)
    client_geo: GeoPoint
    source_channel: ChannelSource = ChannelSource.web
    items: list[CartItem] = Field(min_length=1)


class CheckoutResponse(BaseModel):
    order_id: uuid.UUID
    claim_id: str
    status: OrderClaimStatus
    taxi_class: str
    estimated_delivery_cost_uzs: int


def _extract_merchant_id(
    x_merchant_id: str = Header(..., alias="X-Merchant-Id"),
) -> uuid.UUID:
    try:
        return uuid.UUID(x_merchant_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid_merchant_id_header") from exc


@router.post("/orders/checkout", response_model=CheckoutResponse)
async def checkout_order(
    body: CheckoutRequest,
    db: AsyncSession = Depends(get_db_session),
) -> CheckoutResponse:
    merchant = await db.get(MerchantProfile, body.merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail="merchant_not_found")

    total_weight_kg = sum(item.quantity * item.unit_weight_kg for item in body.items)
    total_volume_m3 = sum(item.quantity * item.unit_volume_m3 for item in body.items)
    store_geo = GeoPoint(lat=float(merchant.latitude), lng=float(merchant.longitude))

    gateway = YandexDeliveryGateway()
    try:
        estimate = await gateway.calculate_shipping_estimate(
            total_weight_kg=total_weight_kg,
            total_volume_m3=total_volume_m3,
            store_geo=store_geo,
            client_geo=body.client_geo,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"shipping_estimate_failed:{exc}") from exc

    claim = OrderClaim(
        client_id=body.client_id,
        merchant_id=body.merchant_id,
        status=OrderClaimStatus.pending,
        delivery_cost=Decimal(estimate.estimated_price_uzs),
        taxi_class=estimate.taxi_class,
        source_channel=body.source_channel,
        payload_json=body.model_dump_json(),
    )
    db.add(claim)
    await db.flush()

    try:
        yandex_claim_id = await gateway.create_claim(
            request_id=str(claim.id),
            estimate=estimate,
            recipient_phone=body.customer_phone,
            store_geo=store_geo,
            client_geo=body.client_geo,
        )
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=502, detail=f"claim_create_failed:{exc}") from exc

    claim.yandex_claim_id = yandex_claim_id
    await db.commit()
    await db.refresh(claim)
    return CheckoutResponse(
        order_id=claim.id,
        claim_id=yandex_claim_id,
        status=claim.status,
        taxi_class=claim.taxi_class,
        estimated_delivery_cost_uzs=int(claim.delivery_cost),
    )


@router.get("/merchant/orders")
async def merchant_orders(
    status: OrderClaimStatus | None = Query(default=None),
    merchant_id: uuid.UUID = Depends(_extract_merchant_id),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    merchant = await db.get(MerchantProfile, merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail="merchant_not_found")

    filters = [
        OrderClaim.merchant_id == merchant_id,
        OrderClaim.status.in_(
            [OrderClaimStatus.pending, OrderClaimStatus.accepted, OrderClaimStatus.courier_assigned]
        ),
    ]
    if status:
        filters.append(OrderClaim.status == status)

    stmt = (
        select(OrderClaim)
        .join(MerchantProfile, MerchantProfile.id == OrderClaim.merchant_id)
        .where(and_(*filters))
        .where(
            MerchantProfile.sector == merchant.sector,
            MerchantProfile.block == merchant.block,
            MerchantProfile.rasta_number == merchant.rasta_number,
        )
        .order_by(OrderClaim.created_at.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    return {
        "merchant": {
            "id": str(merchant.id),
            "bazaar_name": merchant.bazaar_name,
            "sector": merchant.sector,
            "block": merchant.block,
            "rasta_number": merchant.rasta_number,
        },
        "items": [
            {
                "id": str(row.id),
                "client_id": str(row.client_id),
                "yandex_claim_id": row.yandex_claim_id,
                "status": row.status.value,
                "delivery_cost": float(row.delivery_cost),
                "taxi_class": row.taxi_class,
                "source_channel": row.source_channel.value,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ],
    }


@router.post("/merchant/orders/{order_id}/assign-courier")
async def assign_courier(
    order_id: uuid.UUID,
    merchant_id: uuid.UUID = Depends(_extract_merchant_id),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    claim = await db.get(OrderClaim, order_id)
    if not claim or claim.merchant_id != merchant_id:
        raise HTTPException(status_code=404, detail="order_not_found")
    if not claim.yandex_claim_id:
        raise HTTPException(status_code=400, detail="missing_yandex_claim_id")
    if claim.status == OrderClaimStatus.delivered:
        raise HTTPException(status_code=400, detail="order_already_delivered")

    gateway = YandexDeliveryGateway()
    try:
        accept_result = await gateway.accept_claim(claim.yandex_claim_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"claim_accept_failed:{exc}") from exc

    claim.status = OrderClaimStatus.courier_assigned
    await db.commit()
    await db.refresh(claim)
    return {
        "order_id": str(claim.id),
        "yandex_claim_id": claim.yandex_claim_id,
        "status": claim.status.value,
        "accept_result": accept_result,
    }
