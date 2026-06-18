"""Celery worker ichida async SQLAlchemy — har task uchun yangi event loop + engine dispose."""
from __future__ import annotations

import asyncio
from collections.abc import Coroutine
from typing import Any, TypeVar

T = TypeVar("T")


def run_async_task(coro: Coroutine[Any, Any, T]) -> T:
    from app.infrastructure.db.session import engine

    async def _wrapper() -> T:
        try:
            return await coro
        finally:
            await engine.dispose()

    return asyncio.run(_wrapper())
