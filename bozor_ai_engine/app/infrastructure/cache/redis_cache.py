import hashlib
import json

from redis.asyncio import Redis


class SemanticCache:
    def __init__(self, redis_url: str = "redis://localhost:6379/0") -> None:
        self.redis = Redis.from_url(redis_url, decode_responses=True)

    @staticmethod
    def _key(namespace: str, semantic_signature: str) -> str:
        return f"{namespace}:{hashlib.sha256(semantic_signature.encode('utf-8')).hexdigest()}"

    async def get(self, namespace: str, semantic_signature: str) -> dict | None:
        key = self._key(namespace, semantic_signature)
        payload = await self.redis.get(key)
        return json.loads(payload) if payload else None

    async def set(self, namespace: str, semantic_signature: str, value: dict, ttl: int = 1800) -> None:
        key = self._key(namespace, semantic_signature)
        await self.redis.set(key, json.dumps(value), ex=ttl)
