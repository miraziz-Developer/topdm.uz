"""Redis wardrobe session — shown IDs, pagination tier, last search deeplink."""

from __future__ import annotations

import json
from typing import Any

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings


class WardrobeSessionStore:
    def __init__(self) -> None:
        self._redis = Redis.from_url(get_settings().redis_url, decode_responses=True)

    def _key(self, user_id: str, thread_id: str) -> str:
        return f"wardrobe_session:{user_id}:{thread_id}"

    async def load(self, user_id: str, thread_id: str) -> dict[str, Any]:
        try:
            raw = await self._redis.get(self._key(user_id, thread_id))
        except RedisError:
            return _empty()
        if not raw:
            return _empty()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return _empty()
        return data if isinstance(data, dict) else _empty()

    async def save(self, user_id: str, thread_id: str, state: dict[str, Any]) -> None:
        try:
            await self._redis.set(
                self._key(user_id, thread_id),
                json.dumps(state, ensure_ascii=True),
                ex=86400 * 7,
            )
        except RedisError:
            return

    async def append_shown_ids(self, user_id: str, thread_id: str, product_ids: list[str]) -> dict[str, Any]:
        cur = await self.load(user_id, thread_id)
        seen = list(cur.get("recommended_product_ids") or cur.get("shown_product_ids") or [])
        for pid in product_ids:
            s = str(pid)
            if s and s not in seen:
                seen.append(s)
        cur["recommended_product_ids"] = seen[-120:]
        cur["shown_product_ids"] = cur["recommended_product_ids"]
        await self.save(user_id, thread_id, cur)
        return cur

    async def bump_page(self, user_id: str, thread_id: str) -> dict[str, Any]:
        cur = await self.load(user_id, thread_id)
        cur["page_offset"] = int(cur.get("page_offset") or 0) + 1
        await self.save(user_id, thread_id, cur)
        return cur


def _empty() -> dict[str, Any]:
    return {
        "recommended_product_ids": [],
        "shown_product_ids": [],
        "page_offset": 0,
        "last_vibe_tags": [],
        "last_max_price_uzs": None,
        "search_deeplink": None,
    }
