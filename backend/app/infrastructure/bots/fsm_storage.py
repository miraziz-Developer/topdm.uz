"""Bot FSM storage — production da Redis, aks holda MemoryStorage."""

from __future__ import annotations

import logging

from aiogram.fsm.storage.base import BaseStorage
from aiogram.fsm.storage.memory import MemoryStorage

logger = logging.getLogger(__name__)


def build_fsm_storage(redis_url: str | None) -> BaseStorage:
    url = (redis_url or "").strip()
    if not url:
        logger.warning("fsm_storage_memory_no_redis_url")
        return MemoryStorage()

    try:
        from aiogram.fsm.storage.redis import RedisStorage

        storage = RedisStorage.from_url(url)
        logger.info("fsm_storage_redis_ready")
        return storage
    except Exception:
        logger.exception("fsm_storage_redis_failed_fallback_memory")
        return MemoryStorage()
