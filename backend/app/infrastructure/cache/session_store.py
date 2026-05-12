import json

from redis.asyncio import Redis


class UserStylistSessionStore:
    def __init__(self, redis: Redis, ttl_seconds: int = 3600) -> None:
        self._redis = redis
        self._ttl_seconds = ttl_seconds

    async def get(self, user_id: str) -> dict | None:
        raw = await self._redis.get(f"stylist:session:{user_id}")
        if not raw:
            return None
        return json.loads(raw)

    async def set(self, user_id: str, payload: dict) -> None:
        await self._redis.set(
            f"stylist:session:{user_id}",
            json.dumps(payload),
            ex=self._ttl_seconds,
        )


class StylistResponseCache:
    def __init__(self, redis: Redis, ttl_seconds: int = 1800) -> None:
        self._redis = redis
        self._ttl_seconds = ttl_seconds

    async def get(self, cache_key: str) -> dict | None:
        raw = await self._redis.get(f"stylist:response:{cache_key}")
        if not raw:
            return None
        return json.loads(raw)

    async def set(self, cache_key: str, payload: dict) -> None:
        await self._redis.set(
            f"stylist:response:{cache_key}",
            json.dumps(payload),
            ex=self._ttl_seconds,
        )
