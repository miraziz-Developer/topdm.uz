from typing import Protocol

from app.domain.entities.product import Product


class ProductRepository(Protocol):
    async def hybrid_search(
        self,
        query_embedding: list[float],
        filters: dict,
        limit: int = 20,
        min_price: float | None = None,
        max_price: float | None = None,
        block: str | None = None,
    ) -> list[Product]:
        ...
