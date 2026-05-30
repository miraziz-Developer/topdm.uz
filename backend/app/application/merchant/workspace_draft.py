from __future__ import annotations

from typing import Any
from uuid import UUID

from app.infrastructure.cache.redis_gateway import RedisCacheGateway


def _draft_key(shop_id: UUID) -> str:
    return f"merchant:workspace_draft:{shop_id}"


async def load_workspace_draft(shop_id: UUID) -> dict[str, Any]:
    cache = RedisCacheGateway()
    return await cache.get(_draft_key(shop_id)) or {}


async def merge_workspace_draft(shop_id: UUID, patch: dict[str, Any]) -> dict[str, Any]:
    cache = RedisCacheGateway()
    key = _draft_key(shop_id)
    current = await cache.get(key) or {}
    merged = {**current, **{k: v for k, v in patch.items() if v is not None}}
    await cache.set(key, merged, ttl_seconds=60 * 60 * 24 * 14)
    return merged
