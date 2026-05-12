from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import LeadModel, ProductModel, ShopModel, TrackingEventModel

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class ShopDashboardStats:
    total_products: int
    total_leads: int
    total_views: int
    total_visits: int


class MarketplaceRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create_product(
        self,
        *,
        shop_id: UUID,
        category_id: UUID | None,
        name: str,
        description: str | None,
        price: int,
        images: list[str],
        attributes: dict,
        embedding: list[float],
        floor: str | None = None,
        section: str | None = None,
    ) -> ProductModel:
        _ = floor, section
        model = ProductModel(
            shop_id=shop_id,
            category_id=category_id,
            name=name,
            description=description,
            price=price,
            images=images,
            attributes=attributes,
            embedding=embedding,
        )
        self._db.add(model)
        await self._db.commit()
        await self._db.refresh(model)
        logger.info("product_created", extra={"product_id": str(model.id), "shop_id": str(shop_id)})
        return model

    async def get_shop(self, shop_id: UUID) -> ShopModel | None:
        result = await self._db.execute(select(ShopModel).where(ShopModel.id == shop_id))
        return result.scalar_one_or_none()

    async def create_lead(
        self,
        *,
        product_id: UUID,
        shop_id: UUID,
        customer_phone: str,
        customer_name: str | None,
        ref_token: str | None,
    ) -> LeadModel:
        lead = LeadModel(
            product_id=product_id,
            shop_id=shop_id,
            customer_phone=customer_phone,
            customer_name=customer_name,
            ref_token=ref_token,
        )
        self._db.add(lead)
        await self._db.execute(
            ProductModel.__table__.update()
            .where(ProductModel.id == product_id)
            .values(lead_count=ProductModel.lead_count + 1)
        )
        await self._db.commit()
        await self._db.refresh(lead)
        logger.info("lead_created", extra={"lead_id": str(lead.id), "shop_id": str(shop_id)})
        return lead

    async def create_tracking_event(
        self,
        *,
        event_type: str,
        product_id: UUID | None,
        shop_id: UUID | None,
        ref_token: str | None,
        session_id: str | None,
        metadata: dict,
    ) -> TrackingEventModel:
        event = TrackingEventModel(
            event_type=event_type,
            product_id=product_id,
            shop_id=shop_id,
            ref_token=ref_token,
            session_id=session_id,
            tracking_metadata=metadata,
        )
        self._db.add(event)
        await self._db.commit()
        await self._db.refresh(event)
        return event

    async def get_shop_dashboard_stats(self, shop_id: UUID) -> ShopDashboardStats:
        product_count = await self._db.scalar(
            select(func.count(ProductModel.id)).where(ProductModel.shop_id == shop_id)
        )
        lead_count = await self._db.scalar(select(func.count(LeadModel.id)).where(LeadModel.shop_id == shop_id))
        view_count = await self._db.scalar(
            select(func.coalesce(func.sum(ProductModel.view_count), 0)).where(ProductModel.shop_id == shop_id)
        )
        visit_count = await self._db.scalar(
            select(func.coalesce(func.sum(ProductModel.visit_count), 0)).where(ProductModel.shop_id == shop_id)
        )
        return ShopDashboardStats(
            total_products=int(product_count or 0),
            total_leads=int(lead_count or 0),
            total_views=int(view_count or 0),
            total_visits=int(visit_count or 0),
        )

    async def list_shop_leads(self, shop_id: UUID, limit: int = 20) -> Sequence[LeadModel]:
        result = await self._db.execute(
            select(LeadModel).where(LeadModel.shop_id == shop_id).order_by(LeadModel.id.desc()).limit(limit)
        )
        return result.scalars().all()

    async def get_product_by_id(self, product_id: UUID) -> ProductModel | None:
        from sqlalchemy.orm import selectinload
        result = await self._db.execute(
            select(ProductModel)
            .options(selectinload(ProductModel.shop))
            .where(ProductModel.id == product_id)
        )
        return result.scalar_one_or_none()

    async def increment_product_view_count(self, product_id: UUID) -> None:
        from sqlalchemy import update

        await self._db.execute(
            update(ProductModel)
            .where(ProductModel.id == product_id)
            .values(view_count=ProductModel.view_count + 1)
        )
        await self._db.commit()

    async def search_products(self, query: str | None, limit: int, offset: int) -> Sequence[ProductModel]:
        from sqlalchemy.orm import selectinload
        from sqlalchemy import or_
        stmt = select(ProductModel).options(selectinload(ProductModel.shop)).where(ProductModel.is_available == True)
        if query:
            stmt = stmt.where(or_(ProductModel.name.ilike(f"%{query}%"), ProductModel.description.ilike(f"%{query}%")))
        stmt = stmt.order_by(ProductModel.id.desc()).limit(limit).offset(offset)
        result = await self._db.execute(stmt)
        return result.scalars().all()

    async def count_products(self, query: str | None) -> int:
        from sqlalchemy import or_, func
        stmt = select(func.count(ProductModel.id)).where(ProductModel.is_available == True)
        if query:
            stmt = stmt.where(or_(ProductModel.name.ilike(f"%{query}%"), ProductModel.description.ilike(f"%{query}%")))
        result = await self._db.execute(stmt)
        return int(result.scalar() or 0)

    async def get_similar_products(self, product_id: UUID, limit: int = 4) -> Sequence[ProductModel]:
        from sqlalchemy import func
        from sqlalchemy.orm import selectinload

        has_embedding = await self._db.scalar(
            select(func.count(ProductModel.id)).where(ProductModel.id == product_id, ProductModel.embedding.is_not(None))
        )
        if not has_embedding:
            stmt = (
                select(ProductModel)
                .options(selectinload(ProductModel.shop))
                .where(ProductModel.is_available == True, ProductModel.id != product_id)
                .order_by(ProductModel.id.desc())
                .limit(limit)
            )
        else:
            target_embedding_sq = select(ProductModel.embedding).where(ProductModel.id == product_id).scalar_subquery()
            stmt = (
                select(ProductModel)
                .options(selectinload(ProductModel.shop))
                .where(ProductModel.is_available == True, ProductModel.id != product_id)
                .order_by(ProductModel.embedding.cosine_distance(target_embedding_sq))
                .limit(limit)
            )
        result = await self._db.execute(stmt)
        return result.scalars().all()
