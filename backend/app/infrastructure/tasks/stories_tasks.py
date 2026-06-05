from __future__ import annotations

import asyncio

import app.infrastructure.db.models  # noqa: F401
import app.models  # noqa: F401

from loguru import logger

from app.application.stories.service import StoryService
from app.infrastructure.db.session import AsyncSessionFactory
from app.infrastructure.tasks.celery_app import celery_app


@celery_app.task(name="stories.gc_expired", bind=True, max_retries=1)
def gc_expired_stories_task(self) -> dict:
    try:
        return asyncio.run(_gc_async())
    except Exception as exc:
        logger.exception("stories_gc_failed")
        raise self.retry(exc=exc, countdown=300) from exc


async def _gc_async() -> dict:
    async with AsyncSessionFactory() as session:
        svc = StoryService(session)
        result = await svc.gc_expired_stories()
        logger.info("stories_gc_done", **result)
        return result
