from collections.abc import Sequence
from decimal import Decimal
from uuid import UUID

from sqlalchemy import and_, cast, desc, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.marketplace import UnifiedProduct
from app.domain.repositories.product_repository import ProductRepository
from app.infrastructure.db.models import UnifiedProductModel


class ProductRepositoryImpl(ProductRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def vector_search(self, query_embedding: list[float], limit: int = 20) -> Sequence[UnifiedProduct]:
        stmt = (
            select(UnifiedProductModel)
            .order_by(UnifiedProductModel.embedding.cosine_distance(query_embedding))
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [self._to_entity(model) for model in result.scalars().all()]

    async def multimodal_search(
        self, query_embedding: list[float], image_attributes: dict, limit: int = 20
    ) -> Sequence[UnifiedProduct]:
        colors = image_attributes.get("colors", [])
        stmt = (
            select(UnifiedProductModel)
            .where(
                and_(
                    cast(UnifiedProductModel.vision_attributes, JSONB).contains({"colors": colors}),
                )
            )
            .order_by(
                desc(cast(UnifiedProductModel.ai_generated_tags, JSONB).contains({"style": image_attributes.get("style")})),
                UnifiedProductModel.embedding.cosine_distance(query_embedding),
            )
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [self._to_entity(model) for model in result.scalars().all()]

    async def create_auto_listed_product(
        self,
        shop_id: UUID,
        name: str,
        description: str,
        price: float,
        currency: str,
        embedding: list[float],
        ai_generated_tags: dict,
        vision_attributes: dict,
    ) -> UnifiedProduct:
        model = UnifiedProductModel(
            shop_id=shop_id,
            name=name,
            description=description,
            price=Decimal(str(price)),
            currency=currency,
            embedding=embedding,
            ai_generated_tags=ai_generated_tags,
            vision_attributes=vision_attributes,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return self._to_entity(model)

    @staticmethod
    def _to_entity(model: UnifiedProductModel) -> UnifiedProduct:
        return UnifiedProduct(
            id=model.id,
            shop_id=model.shop_id,
            name=model.name,
            description=model.description,
            price=model.price,
            currency=model.currency,
            ai_generated_tags=model.ai_generated_tags,
            vision_attributes=model.vision_attributes,
        )
