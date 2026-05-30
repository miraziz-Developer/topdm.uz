from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.schemas.shop_trust import StoreOperationalKpis
from app.infrastructure.db.models import ShopModel
from app.models.shop_review import ShopReviewModel


class ShopTrustRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_shop(self, shop_id: UUID) -> ShopModel | None:
        return await self._db.get(ShopModel, shop_id)

    async def list_reviews(self, shop_id: UUID, *, limit: int = 20, offset: int = 0) -> list[ShopReviewModel]:
        result = await self._db.execute(
            select(ShopReviewModel)
            .where(ShopReviewModel.shop_id == shop_id, ShopReviewModel.status == "published")
            .order_by(ShopReviewModel.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def count_reviews(self, shop_id: UUID) -> int:
        result = await self._db.execute(
            select(func.count())
            .select_from(ShopReviewModel)
            .where(ShopReviewModel.shop_id == shop_id, ShopReviewModel.status == "published")
        )
        return int(result.scalar_one() or 0)

    async def recompute_rating(self, shop_id: UUID) -> None:
        shop = await self.get_shop(shop_id)
        if not shop:
            return
        result = await self._db.execute(
            select(func.avg(ShopReviewModel.rating), func.count())
            .where(ShopReviewModel.shop_id == shop_id, ShopReviewModel.status == "published")
        )
        avg_rating, count = result.one()
        shop.rating = round(float(avg_rating or shop.rating or 0), 2)
        shop.review_count = int(count or 0)

    async def update_trust_metrics(self, shop_id: UUID, metrics: StoreOperationalKpis) -> ShopModel | None:
        shop = await self.get_shop(shop_id)
        if not shop:
            return None
        shop.trust_metrics = metrics.to_json()
        return shop
