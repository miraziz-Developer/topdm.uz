import json

from redis.asyncio import Redis
from redis.exceptions import RedisError
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import get_settings


class RedisCacheGateway:
    def __init__(self) -> None:
        self._settings = get_settings()
        self._redis = Redis.from_url(self._settings.redis_url, decode_responses=True)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        retry=retry_if_exception_type(RedisError),
        reraise=True,
    )
    async def _get_raw(self, key: str) -> str | None:
        return await self._redis.get(key)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        retry=retry_if_exception_type(RedisError),
        reraise=True,
    )
    async def _set_raw(self, key: str, value: str, ttl_seconds: int) -> None:
        await self._redis.set(key, value, ex=ttl_seconds)

    async def get(self, key: str) -> dict | list | None:
        try:
            raw = await self._get_raw(key)
        except RedisError:
            return None
        return json.loads(raw) if raw else None

    async def set(self, key: str, value: dict | list, ttl_seconds: int = 1800) -> None:
        adaptive_ttl = self._adaptive_ttl(value, ttl_seconds)
        try:
            await self._set_raw(key, json.dumps(value), adaptive_ttl)
        except RedisError:
            return

    async def delete(self, key: str) -> None:
        try:
            await self._redis.delete(key)
        except RedisError:
            return

    async def check_rate_limit(self, user_id: str) -> bool:
        return await self.check_fixed_window(
            f"ratelimit:{user_id}",
            limit=self._settings.user_rate_limit_per_minute,
            window_seconds=60,
        )

    async def check_fixed_window(self, key: str, *, limit: int, window_seconds: int) -> bool:
        """Atomic fixed-window counter; returns False when limit exceeded."""
        try:
            current = await self._redis.incr(key)
            if current == 1:
                await self._redis.expire(key, window_seconds)
            return current <= limit
        except RedisError:
            return True

    async def invalidate_by_product(self, product_id: str) -> None:
        try:
            cursor = 0
            keys: list[str] = []
            while True:
                cursor, batch = await self._redis.scan(cursor, match="stylist:*", count=100)
                keys.extend(batch)
                if cursor == 0:
                    break
            if keys:
                await self._redis.delete(*keys)
            await self._redis.publish("cache_invalidation", product_id)
        except RedisError:
            return

    @staticmethod
    def _adaptive_ttl(value: dict | list, default_ttl: int) -> int:
        if not isinstance(value, dict):
            return default_ttl
        explanation = str(value.get("explanation", "")).lower()
        if "trend" in explanation or "season" in explanation:
            return max(default_ttl, 7200)
        return default_ttl
