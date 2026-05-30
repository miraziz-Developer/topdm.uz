from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.merchant.customer_approach import (
    CustomerApproachService,
    get_approach_settings,
    set_approach_settings,
)
from app.application.merchant.order_pickup_completion import (
    OrderPickupCompletionService,
    get_pickup_settings,
    set_pickup_settings,
)
from app.application.merchant.quick_replies import list_quick_replies
from app.application.merchant.workspace_hub import MerchantWorkspaceHub
from app.infrastructure.auth.deps import AuthUser, require_merchant
from app.infrastructure.auth.merchant_resolve import resolve_merchant_shop
from app.infrastructure.db.session import get_db_session

router = APIRouter(prefix="/merchant", tags=["merchant-workspace"])


async def _shop_id(user: AuthUser, db: AsyncSession) -> UUID:
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop.id


@router.get("/today")
async def merchant_today(
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    hub = MerchantWorkspaceHub(db)
    try:
        return await hub.build_today_panel(await _shop_id(user, db))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/analytics/summary")
async def merchant_analytics_summary(
    days: int = Query(default=7, ge=1, le=90),
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    hub = MerchantWorkspaceHub(db)
    try:
        return await hub.analytics_summary(await _shop_id(user, db), days=days)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/customers/history")
async def merchant_customer_history(
    phone: str = Query(..., min_length=9, max_length=20),
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    hub = MerchantWorkspaceHub(db)
    return await hub.customer_history(await _shop_id(user, db), phone)


@router.get("/share-kit")
async def merchant_share_kit(
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    hub = MerchantWorkspaceHub(db)
    return await hub.share_kit(shop)


@router.get("/chat/quick-replies")
async def merchant_quick_replies() -> dict:
    return {"items": list_quick_replies()}


class BulkDiscountBody(BaseModel):
    percent_off: int = Field(ge=1, le=90)
    product_ids: list[UUID] | None = None


@router.post("/products/bulk-discount")
async def merchant_bulk_discount(
    body: BulkDiscountBody,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    hub = MerchantWorkspaceHub(db)
    try:
        return await hub.bulk_discount(
            await _shop_id(user, db),
            percent_off=body.percent_off,
            product_ids=body.product_ids,
        )
    except ValueError as exc:
        if str(exc) == "percent_off_1_90":
            raise HTTPException(status_code=400, detail="Chegirma 1–90% oralig'ida bo'lishi kerak") from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class RestockNotifyBody(BaseModel):
    message: str | None = Field(default=None, max_length=500)


@router.post("/products/{product_id}/restock-notify")
async def merchant_restock_notify(
    product_id: UUID,
    body: RestockNotifyBody,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    hub = MerchantWorkspaceHub(db)
    try:
        return await hub.restock_notify_leads(
            await _shop_id(user, db),
            product_id=product_id,
            message=body.message,
        )
    except ValueError as exc:
        if str(exc) == "product_not_found":
            raise HTTPException(status_code=404, detail="Mahsulot topilmadi") from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class OperatingHoursBody(BaseModel):
    open: str = Field(default="09:00", max_length=8)
    close: str = Field(default="20:00", max_length=8)
    busy_note: str = Field(default="", max_length=200)


@router.get("/operating-hours")
async def get_operating_hours(
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    hub = MerchantWorkspaceHub(db)
    return await hub.get_operating_hours(await _shop_id(user, db))


class ConfirmPickupBody(BaseModel):
    note: str | None = Field(default=None, max_length=300)


@router.post("/orders/{order_id}/confirm-pickup")
async def merchant_confirm_pickup(
    order_id: UUID,
    body: ConfirmPickupBody,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = OrderPickupCompletionService(db)
    try:
        return await service.confirm_pickup_manual(
            await _shop_id(user, db),
            order_id,
            note=body.note,
        )
    except ValueError as exc:
        if str(exc) == "order_not_found":
            raise HTTPException(status_code=404, detail="Buyurtma topilmadi") from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/pickup-settings")
async def merchant_get_pickup_settings(
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    return {"settings": await get_pickup_settings(await _shop_id(user, db))}


class PickupSettingsBody(BaseModel):
    notify_on_arrival: bool | None = None
    auto_complete_enabled: bool | None = None
    auto_complete_after_minutes: int | None = Field(default=None, ge=5, le=120)
    shop_arrival_radius_m: int | None = Field(default=None, ge=40, le=300)


@router.patch("/pickup-settings")
async def merchant_patch_pickup_settings(
    body: PickupSettingsBody,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    settings = await set_pickup_settings(
        await _shop_id(user, db),
        body.model_dump(exclude_none=True),
    )
    return {"settings": settings}


@router.get("/incoming-visitors")
async def merchant_incoming_visitors(
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = CustomerApproachService(db)
    return await service.list_incoming_visitors(await _shop_id(user, db))


@router.get("/approach-settings")
async def merchant_get_approach_settings(
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    return {"settings": await get_approach_settings(await _shop_id(user, db))}


class ApproachSettingsBody(BaseModel):
    enabled: bool | None = None
    show_on_map: bool | None = None
    alert_radius_km: float | None = Field(default=None, ge=1, le=10)


@router.patch("/approach-settings")
async def merchant_patch_approach_settings(
    body: ApproachSettingsBody,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    settings = await set_approach_settings(
        await _shop_id(user, db),
        body.model_dump(exclude_none=True),
    )
    return {"settings": settings}


@router.patch("/operating-hours")
async def patch_operating_hours(
    body: OperatingHoursBody,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    hub = MerchantWorkspaceHub(db)
    return await hub.set_operating_hours(
        await _shop_id(user, db),
        body.model_dump(),
    )
