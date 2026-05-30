from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.story import StoryModel


class StoryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        shop_id: uuid.UUID,
        image_url: str,
        level_context: str,
        ttl_hours: int = 24,
    ) -> StoryModel:
        now = datetime.now(timezone.utc)
        story = StoryModel(
            shop_id=shop_id,
            image_url=image_url,
            level_context=level_context,
            created_at=now,
            expires_at=now + timedelta(hours=ttl_hours),
        )
        self._session.add(story)
        await self._session.commit()
        await self._session.refresh(story)
        return story

    async def list_live(self, *, limit: int = 40) -> list[StoryModel]:
        now = datetime.now(timezone.utc)
        stmt = (
            select(StoryModel)
            .where(StoryModel.expires_at > now)
            .order_by(StoryModel.created_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
