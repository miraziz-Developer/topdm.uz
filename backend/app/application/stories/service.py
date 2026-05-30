from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.repositories.story_repo import StoryRepository
from app.infrastructure.storage.object_store import ObjectMediaStore
from app.models.story import StoryModel


def build_level_context(*, floor: str | None, section: str | None) -> str:
    parts: list[str] = []
    if floor and floor.strip():
        parts.append(floor.strip())
    if section and section.strip():
        parts.append(section.strip())
    return " · ".join(parts) if parts else "Ippodrom"


def story_is_hot(created_at: datetime, *, window_hours: int = 2) -> bool:
    now = datetime.now(timezone.utc)
    created = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
    return created >= now - timedelta(hours=window_hours)


class StoryService:
    def __init__(self, session: AsyncSession, media: ObjectMediaStore | None = None) -> None:
        self._repo = StoryRepository(session)
        self._media = media or ObjectMediaStore()

    async def publish_story(
        self,
        *,
        shop_id: uuid.UUID,
        image_bytes: bytes,
        content_type: str,
        level_context: str,
    ) -> StoryModel:
        extension = _extension_from_content_type(content_type)
        image_url = await self._media.save_story_image(
            shop_id=shop_id,
            image_bytes=image_bytes,
            extension=extension,
            content_type=content_type,
        )
        return await self._repo.create(
            shop_id=shop_id,
            image_url=image_url,
            level_context=level_context,
        )

    async def list_live_stories(self, *, limit: int = 40) -> list[StoryModel]:
        return await self._repo.list_live(limit=limit)


def _extension_from_content_type(content_type: str) -> str:
    lowered = (content_type or "").lower()
    if "png" in lowered:
        return "png"
    if "webp" in lowered:
        return "webp"
    return "jpg"
