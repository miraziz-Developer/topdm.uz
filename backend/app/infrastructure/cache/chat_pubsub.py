from __future__ import annotations

import json
from typing import Any

from loguru import logger
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings


def chat_channel(thread_id: str) -> str:
    return f"chat:thread:{thread_id}"


def shop_inbox_channel(shop_id: str) -> str:
    return f"chat:shop_inbox:{shop_id}"


def merchant_online_key(shop_id: str) -> str:
    return f"chat:merchant_online:{shop_id}"


class ChatPubSubGateway:
    def __init__(self) -> None:
        settings = get_settings()
        self._redis = Redis.from_url(settings.redis_url, decode_responses=True)

    async def publish_message(self, thread_id: str, payload: dict[str, Any]) -> bool:
        try:
            receivers = await self._redis.publish(
                chat_channel(thread_id),
                json.dumps(payload, ensure_ascii=True),
            )
            return receivers >= 0
        except RedisError:
            logger.exception("chat_pubsub_publish_failed", thread_id=thread_id)
            return False

    async def publish_inbox_update(self, shop_id: str, payload: dict[str, Any]) -> bool:
        try:
            receivers = await self._redis.publish(
                shop_inbox_channel(shop_id),
                json.dumps(payload, ensure_ascii=True),
            )
            return receivers >= 0
        except RedisError:
            logger.exception("chat_inbox_pubsub_publish_failed", shop_id=shop_id)
            return False

    async def set_merchant_online(self, shop_id: str, *, ttl_seconds: int = 90) -> bool:
        try:
            await self._redis.set(merchant_online_key(shop_id), "1", ex=ttl_seconds)
            return True
        except RedisError:
            logger.warning("chat_merchant_online_set_failed", shop_id=shop_id)
            return False

    async def is_merchant_online(self, shop_id: str) -> bool:
        try:
            return bool(await self._redis.exists(merchant_online_key(shop_id)))
        except RedisError:
            logger.warning("chat_merchant_online_check_failed", shop_id=shop_id)
            return False

    async def check_ws_rate_limit(self, client_key: str, *, limit: int = 30) -> bool:
        key = f"chat_ws_ratelimit:{client_key}"
        try:
            current = await self._redis.incr(key)
            if current == 1:
                await self._redis.expire(key, 60)
            return current <= limit
        except RedisError:
            logger.warning("chat_ws_rate_limit_failed", client_key=client_key)
            return True

    def pubsub(self):
        return self._redis.pubsub()
