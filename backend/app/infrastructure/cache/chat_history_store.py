from __future__ import annotations

import json
from typing import Any

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings


class ChatHistoryStore:
    """Redis-backed short-term chat history for the Bozorliii agent (per user + thread)."""

    def __init__(self) -> None:
        self._settings = get_settings()
        self._redis = Redis.from_url(self._settings.redis_url, decode_responses=True)

    def _key(self, user_id: str, thread_id: str) -> str:
        return f"chat_agent:{user_id}:{thread_id}"

    async def load(self, user_id: str, thread_id: str, *, max_messages: int = 24) -> list[dict[str, Any]]:
        key = self._key(user_id, thread_id)
        try:
            raw = await self._redis.get(key)
        except RedisError:
            return []
        if not raw:
            return []
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return []
        if not isinstance(data, list):
            return []
        return data[-max_messages:]

    async def append_turn(
        self,
        user_id: str,
        thread_id: str,
        *,
        user_message: str,
        assistant_message: str,
        ttl_seconds: int = 86400 * 7,
        max_messages: int = 40,
    ) -> None:
        key = self._key(user_id, thread_id)
        try:
            raw = await self._redis.get(key)
            cur = json.loads(raw) if raw else []
            if not isinstance(cur, list):
                cur = []
            cur.append({"role": "user", "content": user_message})
            cur.append({"role": "assistant", "content": assistant_message})
            cur = cur[-max_messages:]
            await self._redis.set(key, json.dumps(cur, ensure_ascii=True), ex=ttl_seconds)
        except RedisError:
            return
