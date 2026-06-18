from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from datetime import datetime, timezone

from app.domain.schemas.shop_trust import (
    ShopTrustMetrics,
    StoreOperationalKpis,
    StoreRatingMetrics,
    StoreReviewPayload,
)
from app.infrastructure.repositories.shop_trust_repo import ShopTrustRepository
from app.models.shop_review import ShopReviewModel


def _default_kpis(review_count: int) -> StoreOperationalKpis:
    """Ma'lumot yetmasa soxta KPI ko'rsatilmaydi."""
    del review_count
    return StoreOperationalKpis(
        order_fulfillment_rate=0.0,
        product_match_rate=0.0,
        average_response_time_min=0,
        quality_guarantee=False,
        badges=[],
        rating_distribution={"5": 0, "4": 0, "3": 0, "2": 0, "1": 0},
    )


def review_to_payload(row: ShopReviewModel) -> StoreReviewPayload:
    return StoreReviewPayload(
        id=row.id,
        user_id=row.user_id,
        store_id=row.shop_id,
        rating=row.rating,
        comment=row.body,
        created_at=row.created_at,
    )


class ShopTrustService:
    def __init__(self, db: AsyncSession) -> None:
        self._repo = ShopTrustRepository(db)
        self._db = db

    @staticmethod
    def resolve_operational_kpis(shop) -> StoreOperationalKpis:
        raw = getattr(shop, "trust_metrics", None) or {}
        if isinstance(raw, dict) and raw:
            return StoreOperationalKpis.from_json(raw)
        return _default_kpis(int(getattr(shop, "review_count", 0) or 0))

    @staticmethod
    def build_store_rating_metrics(shop) -> StoreRatingMetrics:
        review_count = int(getattr(shop, "review_count", 0) or 0)
        rating = float(getattr(shop, "rating", 0) or 0)
        average = round(max(0.0, min(5.0, rating if rating >= 1 else 0.0)), 1)
        kpis = ShopTrustService.resolve_operational_kpis(shop)
        updated = getattr(shop, "updated_at", None) or datetime.now(timezone.utc)
        return StoreRatingMetrics(
            store_id=shop.id,
            average_rating=average,
            total_reviews_count=review_count,
            order_fulfillment_rate=kpis.order_fulfillment_rate,
            product_match_rate=kpis.product_match_rate,
            average_response_time_min=kpis.average_response_time_min,
            updated_at=updated,
        )

    @staticmethod
    def resolve_trust_metrics(shop) -> ShopTrustMetrics:
        store_metrics = ShopTrustService.build_store_rating_metrics(shop)
        kpis = ShopTrustService.resolve_operational_kpis(shop)
        return ShopTrustMetrics.from_store_metrics(store_metrics, kpis)

    async def get_crm_snapshot(self, shop_id: UUID) -> dict:
        shop = await self._repo.get_shop(shop_id)
        if not shop:
            raise ValueError("shop_not_found")
        metrics = self.build_store_rating_metrics(shop)
        display = self.resolve_trust_metrics(shop)
        reviews = await self._repo.list_reviews(shop_id, limit=10)
        return {
            "store_rating_metrics": metrics.model_dump(mode="json"),
            "store_reviews": [review_to_payload(r).model_dump(mode="json") for r in reviews],
            "trust_metrics": display.to_json(),
            "shop_id": str(shop.id),
            "rating": metrics.average_rating,
            "review_count": metrics.total_reviews_count,
        }

    async def patch_operational_kpis(self, shop_id: UUID, patch: dict) -> dict:
        shop = await self._repo.get_shop(shop_id)
        if not shop:
            raise ValueError("shop_not_found")
        current = self.resolve_operational_kpis(shop)
        merged = current.model_copy(update={k: v for k, v in patch.items() if v is not None})
        await self._repo.update_trust_metrics(shop_id, merged)
        await self._db.commit()
        await self._db.refresh(shop)
        metrics = self.build_store_rating_metrics(shop)
        return {
            "store_rating_metrics": metrics.model_dump(mode="json"),
            "trust_metrics": self.resolve_trust_metrics(shop).to_json(),
        }
