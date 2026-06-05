from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.application.stories.constants import STORY_TTL_HOURS
from app.core.config import get_settings
from app.infrastructure.db.models import ShopModel
from app.models.story import StoryModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class StoryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def _live_clause(self, now: datetime):
        return (
            StoryModel.expires_at > now,
            StoryModel.is_active.is_(True),
            ShopModel.is_active.is_(True),
            ShopModel.is_blocked.is_(False),
        )

    async def create(
        self,
        *,
        shop_id: uuid.UUID,
        image_url: str,
        level_context: str,
        ttl_hours: int | None = None,
    ) -> StoryModel:
        hours = ttl_hours if ttl_hours is not None else get_settings().story_ttl_hours or STORY_TTL_HOURS
        now = _utcnow()
        story = StoryModel(
            shop_id=shop_id,
            image_url=image_url,
            level_context=level_context,
            created_at=now,
            expires_at=now + timedelta(hours=hours),
            is_active=True,
        )
        self._session.add(story)
        await self._session.commit()
        await self._session.refresh(story)
        return story

    async def count_active_for_shop(self, shop_id: uuid.UUID) -> int:
        now = _utcnow()
        stmt = (
            select(func.count())
            .select_from(StoryModel)
            .where(
                StoryModel.shop_id == shop_id,
                StoryModel.expires_at > now,
                StoryModel.is_active.is_(True),
            )
        )
        result = await self._session.execute(stmt)
        return int(result.scalar_one() or 0)

    async def list_dock_previews(self, *, shop_limit: int = 15) -> list[tuple[StoryModel, int]]:
        """Har do'kon uchun eng yangi story + faol storylar soni (PostgreSQL DISTINCT ON)."""
        now = _utcnow()
        stmt = (
            select(StoryModel)
            .distinct(StoryModel.shop_id)
            .join(ShopModel, StoryModel.shop_id == ShopModel.id)
            .options(joinedload(StoryModel.shop))
            .where(*self._live_clause(now))
            .order_by(StoryModel.shop_id, StoryModel.created_at.desc())
            .limit(shop_limit)
        )
        result = await self._session.execute(stmt)
        previews = list(result.scalars().unique().all())
        if not previews:
            return []

        shop_ids = [s.shop_id for s in previews]
        count_stmt = (
            select(StoryModel.shop_id, func.count())
            .where(
                StoryModel.shop_id.in_(shop_ids),
                StoryModel.expires_at > now,
                StoryModel.is_active.is_(True),
            )
            .group_by(StoryModel.shop_id)
        )
        counts_result = await self._session.execute(count_stmt)
        count_map = {row[0]: int(row[1]) for row in counts_result.all()}
        return [(s, count_map.get(s.shop_id, 1)) for s in previews]

    async def list_live_for_shop(self, shop_id: uuid.UUID, *, limit: int = 3) -> list[StoryModel]:
        now = _utcnow()
        stmt = (
            select(StoryModel)
            .join(ShopModel, StoryModel.shop_id == ShopModel.id)
            .options(joinedload(StoryModel.shop))
            .where(
                StoryModel.shop_id == shop_id,
                *self._live_clause(now),
            )
            .order_by(StoryModel.created_at.asc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().unique().all())

    async def list_live(self, *, limit: int = 40, shop_id: uuid.UUID | None = None) -> list[StoryModel]:
        now = _utcnow()
        stmt = (
            select(StoryModel)
            .join(ShopModel, StoryModel.shop_id == ShopModel.id)
            .options(joinedload(StoryModel.shop))
            .where(*self._live_clause(now))
            .order_by(StoryModel.created_at.desc())
            .limit(limit)
        )
        if shop_id is not None:
            stmt = stmt.where(StoryModel.shop_id == shop_id)
        result = await self._session.execute(stmt)
        return list(result.scalars().unique().all())

    async def list_for_shop(self, shop_id: uuid.UUID, *, limit: int = 10) -> list[StoryModel]:
        return await self.list_live_for_shop(shop_id, limit=limit)

    async def get_for_shop(self, shop_id: uuid.UUID, story_id: uuid.UUID) -> StoryModel | None:
        stmt = select(StoryModel).where(
            StoryModel.id == story_id,
            StoryModel.shop_id == shop_id,
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def delete_for_shop(self, shop_id: uuid.UUID, story_id: uuid.UUID) -> StoryModel | None:
        story = await self.get_for_shop(shop_id, story_id)
        if story is None:
            return None
        image_url = story.image_url
        await self._session.delete(story)
        await self._session.commit()
        story.image_url = image_url
        return story

    async def list_expired_batch(self, *, limit: int = 200) -> list[StoryModel]:
        now = _utcnow()
        stmt = (
            select(StoryModel)
            .where(StoryModel.expires_at <= now)
            .order_by(StoryModel.expires_at.asc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
