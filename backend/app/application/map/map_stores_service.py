from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.map.market_slugs import market_zone_for_slug
from app.application.map.store_locations import shop_to_map_store, stores_to_geojson
from app.infrastructure.cache.redis_gateway import RedisCacheGateway
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository

_CACHE_KEY = "map:stores:v4"
_CACHE_TTL = 300


class MapStoresService:
    def __init__(self, db: AsyncSession, cache: RedisCacheGateway | None = None) -> None:
        self._repo = MarketplaceRepository(db)
        self._cache = cache or RedisCacheGateway()

    async def get_stores_geojson(self, *, market_slug: str = "ippodrom") -> dict:
        cache_key = f"{_CACHE_KEY}:{market_slug}"
        cached = await self._cache.get(cache_key)
        if cached and isinstance(cached.get("stores"), list):
            cached["cached"] = True
            return cached

        zone = market_zone_for_slug(market_slug)
        shops = await self._repo.list_active_shops_for_map(limit=500, market_zone=zone)
        stores = [shop_to_map_store(shop) for shop in shops]
        payload = stores_to_geojson(stores)
        payload["cached"] = False
        payload["market_slug"] = market_slug

        await self._cache.set(cache_key, payload, ttl_seconds=_CACHE_TTL)
        return payload
