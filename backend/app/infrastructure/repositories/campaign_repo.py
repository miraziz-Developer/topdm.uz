from __future__ import annotations

from datetime import datetime, timezone
from typing import Sequence
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.db.models import ProductModel
from app.models.campaign import FlashSaleModel, LightningDealModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class CampaignRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_active_lightning_products(self, *, limit: int = 16) -> Sequence[ProductModel]:
        now = _now()
        stmt = (
            select(ProductModel)
            .join(LightningDealModel, LightningDealModel.product_id == ProductModel.id)
            .options(selectinload(ProductModel.shop))
            .where(
                LightningDealModel.is_active.is_(True),
                LightningDealModel.start_time <= now,
                LightningDealModel.end_time >= now,
                ProductModel.is_available.is_(True),
                or_(
                    LightningDealModel.stock_limit == 0,
                    LightningDealModel.sold_count < LightningDealModel.stock_limit,
                ),
            )
            .order_by(LightningDealModel.priority.desc(), LightningDealModel.start_time.asc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return result.scalars().unique().all()

    async def list_active_flash_sale_products(self, *, limit: int = 16) -> Sequence[ProductModel]:
        now = _now()
        stmt = (
            select(ProductModel)
            .join(FlashSaleModel, FlashSaleModel.product_id == ProductModel.id)
            .options(selectinload(ProductModel.shop))
            .where(
                FlashSaleModel.is_active.is_(True),
                FlashSaleModel.start_time <= now,
                FlashSaleModel.end_time >= now,
                ProductModel.is_available.is_(True),
                or_(
                    FlashSaleModel.stock_limit == 0,
                    FlashSaleModel.sold_count < FlashSaleModel.stock_limit,
                ),
            )
            .order_by(FlashSaleModel.discount_rate.desc(), FlashSaleModel.end_time.asc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return result.scalars().unique().all()
