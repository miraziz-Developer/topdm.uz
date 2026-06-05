"""Bosh sahifa: trending, clearance, tavsiya — yagona feed."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.marketplace.product_list_enrichment import products_to_public_dicts
from app.infrastructure.db.models import OrderModel
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


class HomeFeedService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = MarketplaceRepository(session)

    async def get_deal_feed(self, *, limit: int = 16) -> dict:
        limit = max(4, min(limit, 24))
        lightning = list(await self._repo.list_lightning_deal_products(limit=limit))
        clearance = list(await self._repo.list_clearance_deal_products(limit=limit))

        if len(lightning) < 4:
            featured = list(await self._repo.list_featured_products(limit=limit))
            seen = {p.id for p in lightning}
            for p in featured:
                if p.id not in seen:
                    lightning.append(p)
                    seen.add(p.id)
        if len(lightning) < 4:
            trending = list(await self._repo.list_trending_products(limit=limit))
            seen = {p.id for p in lightning}
            for p in trending:
                if p.id not in seen:
                    lightning.append(p)
                    seen.add(p.id)

        if len(clearance) < 4:
            cheap = list(await self._repo.list_clearance_deal_products(limit=limit))
            seen = {p.id for p in clearance}
            for p in cheap:
                if p.id not in seen:
                    clearance.append(p)
                    seen.add(p.id)
            if len(clearance) < 4:
                trending = list(await self._repo.list_trending_products(limit=limit))
                for p in trending:
                    if p.id not in seen and len(clearance) < limit:
                        clearance.append(p)
                        seen.add(p.id)

        pool = lightning + clearance
        await _attach_sold_counts(self._session, pool)

        recommended = list(await self._repo.list_trending_products(limit=limit))
        await _attach_sold_counts(self._session, recommended)

        return {
            "lightning": await products_to_public_dicts(self._session, lightning[:limit]),
            "clearance": await products_to_public_dicts(self._session, clearance[:limit]),
            "recommended": await products_to_public_dicts(self._session, recommended[:limit]),
        }
