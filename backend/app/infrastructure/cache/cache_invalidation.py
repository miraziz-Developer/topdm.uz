from app.domain.interfaces.cache_invalidation_observer import CacheInvalidationObserver
from app.infrastructure.cache.redis_gateway import RedisCacheGateway


class RedisCacheInvalidationObserver(CacheInvalidationObserver):
    def __init__(self, cache: RedisCacheGateway) -> None:
        self._cache = cache

    async def on_product_updated(self, product_id: str) -> None:
        await self._cache.invalidate_by_product(product_id)

    async def on_product_deleted(self, product_id: str) -> None:
        await self._cache.invalidate_by_product(product_id)
