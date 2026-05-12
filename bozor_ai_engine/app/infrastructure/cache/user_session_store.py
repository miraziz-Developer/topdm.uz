import json

from redis.asyncio import Redis


class UserStylistSessionStore:
    def __init__(self, redis_url: str = "redis://localhost:6379/0") -> None:
        self.redis = Redis.from_url(redis_url, decode_responses=True)

    async def save(self, user_id: str, payload: dict, ttl: int = 3600) -> None:
        await self.redis.set(f"user:stylist:{user_id}", json.dumps(payload), ex=ttl)

    async def get(self, user_id: str) -> dict | None:
        raw = await self.redis.get(f"user:stylist:{user_id}")
        return json.loads(raw) if raw else None
