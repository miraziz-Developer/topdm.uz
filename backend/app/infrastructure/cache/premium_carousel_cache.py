from __future__ import annotations

import json
from typing import Any

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings

CAROUSEL_CONFIG_KEY = "bozor:home:carousel:config"
CAROUSEL_VERSION_KEY = "bozor:home:carousel:version"
INVALIDATION_CHANNEL = "bozor:home:carousel:invalidate"

DEFAULT_CONFIG: dict[str, Any] = {
    "enabled": True,
    "crossfade": True,
    "autoplay": True,
    "interval_ms": 4500,
}


class PremiumCarouselCache:
    def __init__(self) -> None:
        self._settings = get_settings()
        self._redis = Redis.from_url(self._settings.redis_url, decode_responses=True)

    async def get_config(self) -> dict[str, Any]:
        try:
            raw = await self._redis.get(CAROUSEL_CONFIG_KEY)
            if raw:
                return {**DEFAULT_CONFIG, **json.loads(raw)}
        except RedisError:
            pass
        return dict(DEFAULT_CONFIG)

    async def set_config(self, patch: dict[str, Any]) -> dict[str, Any]:
        current = await self.get_config()
        current.update({k: v for k, v in patch.items() if v is not None})
        try:
            await self._redis.set(CAROUSEL_CONFIG_KEY, json.dumps(current, ensure_ascii=True))
        except RedisError:
            pass
        return current

    async def get_version(self) -> int:
        try:
            raw = await self._redis.get(CAROUSEL_VERSION_KEY)
            return int(raw or 0)
        except RedisError:
            return 0

    async def bump_invalidation(self) -> int:
        """Increment carousel version and publish invalidation for home clients."""
        try:
            version = await self._redis.incr(CAROUSEL_VERSION_KEY)
            await self._redis.publish(INVALIDATION_CHANNEL, str(version))
            return int(version)
        except RedisError:
            return 0
