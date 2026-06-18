from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.merchant.growth_service import MerchantGrowthService
from app.infrastructure.auth.deps import AuthUser, require_merchant
from app.infrastructure.auth.merchant_resolve import resolve_merchant_shop
from app.infrastructure.db.session import get_db_session

router = APIRouter(prefix="/merchant/growth", tags=["merchant-growth"])


async def _shop_id(user: AuthUser, db: AsyncSession) -> UUID:
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop.id


@router.get("/sales-report-card")
async def sales_report_card(
    period: str = Query(default="week", pattern="^(week|month)$"),
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    svc = MerchantGrowthService(db)
    try:
        return await svc.sales_report_card(await _shop_id(user, db), period=period)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/referral")
async def referral_panel(
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    svc = MerchantGrowthService(db)
    try:
        return await svc.referral_panel(await _shop_id(user, db))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


class SupplierLinkRequest(BaseModel):
    supplier_slug: str = Field(..., min_length=2, max_length=120)


@router.get("/suppliers")
async def list_suppliers(
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    svc = MerchantGrowthService(db)
    items = await svc.list_suppliers(await _shop_id(user, db))
    return {"items": items}


@router.post("/suppliers/link")
async def link_supplier(
    body: SupplierLinkRequest,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    svc = MerchantGrowthService(db)
    try:
        return await svc.link_supplier(await _shop_id(user, db), body.supplier_slug)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/suppliers/{supplier_shop_id}/products")
async def supplier_products(
    supplier_shop_id: UUID,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    svc = MerchantGrowthService(db)
    try:
        items = await svc.list_supplier_products(await _shop_id(user, db), supplier_shop_id)
        return {"items": items}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/suppliers/import/{product_id}")
async def import_supplier_product(
    product_id: UUID,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    svc = MerchantGrowthService(db)
    try:
        return await svc.import_supplier_product(await _shop_id(user, db), product_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
