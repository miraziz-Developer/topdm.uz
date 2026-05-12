from sqlalchemy import and_, cast, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.lead import LeadEvent
from app.domain.models.product import UnifiedProduct
from app.domain.models.shop import GlobalShop


class ProductRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def vector_search(self, query_vector: list[float], limit: int = 15) -> list[UnifiedProduct]:
        stmt = select(UnifiedProduct).order_by(UnifiedProduct.embedding.cosine_distance(query_vector)).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def hybrid_search(self, query_vector: list[float], attributes: dict, limit: int = 15) -> list[UnifiedProduct]:
        filters = []
        if attributes.get("material"):
            filters.append(cast(UnifiedProduct.ai_metadata, JSONB).contains({"material": attributes["material"]}))
        if attributes.get("style_type"):
            filters.append(cast(UnifiedProduct.ai_metadata, JSONB).contains({"style_type": attributes["style_type"]}))
        if attributes.get("colors_hex"):
            filters.append(cast(UnifiedProduct.ai_metadata, JSONB).contains({"colors_hex": attributes["colors_hex"]}))

        stmt = select(UnifiedProduct)
        if filters:
            stmt = stmt.where(and_(*filters))
        stmt = stmt.order_by(UnifiedProduct.embedding.cosine_distance(query_vector)).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class ShopRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, shop: GlobalShop) -> GlobalShop:
        self.db.add(shop)
        await self.db.commit()
        await self.db.refresh(shop)
        return shop


class LeadRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def track(self, lead: LeadEvent) -> LeadEvent:
        self.db.add(lead)
        await self.db.commit()
        await self.db.refresh(lead)
        return lead
