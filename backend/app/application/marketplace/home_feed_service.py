"""Bosh sahifa: trending, clearance, tavsiya — yagona feed."""
from __future__ import annotations

from uuid import UUID

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.marketplace.product_list_enrichment import products_to_public_dicts
from app.infrastructure.db.models import OrderModel, ProductModel
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository


async def _attach_sold_counts(session: AsyncSession, products: list) -> None:
    if not products:
        return
    ids = [p.id for p in products]
    rows = await session.execute(
        select(OrderModel.product_id, func.coalesce(func.sum(OrderModel.quantity), 0))
        .where(OrderModel.product_id.in_(ids), OrderModel.status == "completed")
        .group_by(OrderModel.product_id)
    )
    sold_map = {pid: int(qty) for pid, qty in rows.all()}
    for p in products:
        setattr(p, "sold_count", sold_map.get(p.id, 0))


def _is_clearance_qualifying(product: ProductModel) -> bool:
    stock = int(product.stock_count or 0)
    if 0 < stock <= 10:
        return True
    attrs = product.attributes if isinstance(product.attributes, dict) else {}
    promo = attrs.get("promo_percent") or attrs.get("discount_percent")
    if promo is not None:
        try:
            return int(promo) > 0
        except (TypeError, ValueError):
            return False
    return False


class HomeFeedService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = MarketplaceRepository(session)

    async def get_deal_feed(self, *, limit: int = 16, user_id: UUID | None = None) -> dict:
        limit = max(1, min(limit, 24))

        lightning = list(await self._repo.list_lightning_deal_products(limit=limit))
        if len(lightning) < limit:
            featured = list(await self._repo.list_featured_products(limit=limit))
            seen = {p.id for p in lightning}
            for product in featured:
                if product.id not in seen:
                    lightning.append(product)
                    seen.add(product.id)
                if len(lightning) >= limit:
                    break

        lightning_ids = {p.id for p in lightning}
        clearance_candidates = list(await self._repo.list_clearance_deal_products(limit=limit))
        clearance = [
            p
            for p in clearance_candidates
            if p.id not in lightning_ids and _is_clearance_qualifying(p)
        ]

        trending = list(await self._repo.list_trending_products(limit=limit))
        used_ids = lightning_ids | {p.id for p in clearance}
        recommended: list = []
        if user_id:
            cat_ids = await self._repo.list_user_preferred_category_ids(user_id)
            if cat_ids:
                recommended = list(
                    await self._repo.list_products_in_categories(
                        cat_ids,
                        limit=limit,
                        exclude_ids=used_ids,
                    )
                )
        if len(recommended) < limit:
            for p in trending:
                if p.id not in used_ids and p.id not in {x.id for x in recommended}:
                    recommended.append(p)
                if len(recommended) >= limit:
                    break
        recommended = recommended[:limit]

        pool = lightning + clearance + recommended
        await _attach_sold_counts(self._session, pool)

        return {
            "lightning": await products_to_public_dicts(self._session, lightning[:limit]),
            "clearance": await products_to_public_dicts(self._session, clearance[:limit]),
            "recommended": await products_to_public_dicts(self._session, recommended[:limit]),
        }
