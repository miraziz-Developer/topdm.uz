from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.auth.deps import require_merchant
from app.infrastructure.auth.merchant_resolve import resolve_merchant_shop
from app.infrastructure.auth.types import AuthUser
from app.infrastructure.db.session import get_db_session
from app.models.campaign import FlashSaleModel, LightningDealModel

router = APIRouter(prefix="/crm/campaigns", tags=["crm-campaigns"])


class CampaignBody(BaseModel):
    product_id: UUID
    discount_rate: float = Field(..., gt=0, lt=1)
    start_time: datetime
    end_time: datetime
    stock_limit: int = Field(default=0, ge=0)


async def _shop_id(user: AuthUser, db: AsyncSession) -> UUID:
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    return shop.id


@router.post("/lightning")
async def create_lightning_deal(
    body: CampaignBody,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop_id = await _shop_id(user, db)
    if body.end_time <= body.start_time:
        raise HTTPException(status_code=400, detail="invalid_time_window")
    row = LightningDealModel(
        product_id=body.product_id,
        shop_id=shop_id,
        discount_rate=Decimal(str(body.discount_rate)),
        start_time=body.start_time,
        end_time=body.end_time,
        stock_limit=body.stock_limit,
        is_active=True,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {"status": "ok", "id": str(row.id), "type": "lightning"}


@router.post("/flash-sale")
async def create_flash_sale(
    body: CampaignBody,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop_id = await _shop_id(user, db)
    if body.end_time <= body.start_time:
        raise HTTPException(status_code=400, detail="invalid_time_window")
    row = FlashSaleModel(
        product_id=body.product_id,
        shop_id=shop_id,
        discount_rate=Decimal(str(body.discount_rate)),
        start_time=body.start_time,
        end_time=body.end_time,
        stock_limit=body.stock_limit,
        is_active=True,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {"status": "ok", "id": str(row.id), "type": "flash_sale"}
