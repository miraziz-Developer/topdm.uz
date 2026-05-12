from decimal import Decimal

from sqlalchemy import and_, cast, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.product import Product
from app.infrastructure.db.models import GlobalShopModel, UnifiedProductModel


class ProductRepo:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def hybrid_search(
        self,
        query_embedding: list[float],
        filters: dict,
        limit: int = 20,
        min_price: float | None = None,
        max_price: float | None = None,
        block: str | None = None,
    ) -> list[Product]:
        clauses = []
        if min_price is not None:
            clauses.append(UnifiedProductModel.price >= Decimal(str(min_price)))
        if max_price is not None:
            clauses.append(UnifiedProductModel.price <= Decimal(str(max_price)))
        if block:
            clauses.append(GlobalShopModel.block == block)
        if filters.get("category"):
            clauses.append(cast(UnifiedProductModel.ai_generated_tags, JSONB).contains({"category": filters["category"]}))
        if filters.get("color"):
            clauses.append(cast(UnifiedProductModel.ai_generated_tags, JSONB).contains({"color": filters["color"]}))
        if filters.get("material"):
            clauses.append(cast(UnifiedProductModel.ai_generated_tags, JSONB).contains({"material": filters["material"]}))

        stmt = (
            select(UnifiedProductModel, GlobalShopModel)
            .join(GlobalShopModel, GlobalShopModel.id == UnifiedProductModel.shop_id)
            .order_by(UnifiedProductModel.embedding.cosine_distance(query_embedding))
            .limit(limit)
        )
        if clauses:
            stmt = stmt.where(and_(*clauses))

        result = await self._db.execute(stmt)
        rows = result.all()
        return [
            Product(
                id=str(product.id),
                name=product.name,
                price=float(product.price),
                currency=product.currency,
                image_url=(product.vision_attributes or {}).get("image_url"),
                shop_location=f"{shop.block}-{shop.row}",
                ai_metadata=product.ai_generated_tags or {},
            )
            for product, shop in rows
        ]
