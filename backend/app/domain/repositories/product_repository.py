from collections.abc import Sequence
from uuid import UUID

from app.domain.entities.marketplace import UnifiedProduct


class ProductRepository:
    async def vector_search(self, query_embedding: list[float], limit: int = 20) -> Sequence[UnifiedProduct]:
        raise NotImplementedError

    async def multimodal_search(
        self, query_embedding: list[float], image_attributes: dict, limit: int = 20
    ) -> Sequence[UnifiedProduct]:
        raise NotImplementedError

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
        raise NotImplementedError
