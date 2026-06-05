from __future__ import annotations

import uuid
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.stories.constants import (
    MAX_ACTIVE_STORIES_PER_SHOP,
    STORY_DOCK_SHOP_LIMIT,
    STORY_GC_BATCH_SIZE,
    STORY_TTL_HOURS,
)
from app.application.stories.errors import StoryLimitError
from app.infrastructure.repositories.story_repo import StoryRepository
from app.infrastructure.storage.media_delete import delete_media_by_url
from app.infrastructure.storage.object_store import ObjectMediaStore
from app.interfaces.api.serializers import story_to_dict
from app.models.story import StoryModel


def build_level_context(*, floor: str | None, section: str | None) -> str:
    parts: list[str] = []
    if floor and floor.strip():
        parts.append(floor.strip())
    if section and section.strip():
        parts.append(section.strip())
    return " · ".join(parts) if parts else "Ippodrom"


def story_is_hot(created_at, *, window_hours: int = 2) -> bool:
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)
    created = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
    return created >= now - timedelta(hours=window_hours)


class StoryService:
    def __init__(self, session: AsyncSession, media: ObjectMediaStore | None = None) -> None:
        self._repo = StoryRepository(session)
        self._media = media or ObjectMediaStore()
        self._session = session

    async def publish_story(
        self,
        *,
        shop_id: UUID,
        image_bytes: bytes,
        content_type: str,
        level_context: str,
    ) -> StoryModel:
        active = await self._repo.count_active_for_shop(shop_id)
        if active >= MAX_ACTIVE_STORIES_PER_SHOP:
            raise StoryLimitError(active_count=active, limit=MAX_ACTIVE_STORIES_PER_SHOP)

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
            ttl_hours=STORY_TTL_HOURS,
        )

    async def delete_story(self, shop_id: UUID, story_id: UUID) -> bool:
        removed = await self._repo.delete_for_shop(shop_id, story_id)
        if removed is None:
            return False
        await delete_media_by_url(removed.image_url)
        return True

    async def list_live_stories(self, *, limit: int = 40) -> list[StoryModel]:
        return await self._repo.list_live(limit=limit)

    async def list_dock(self, *, shop_limit: int | None = None) -> list[dict[str, Any]]:
        cap = min(max(shop_limit or STORY_DOCK_SHOP_LIMIT, 1), 30)
        rows = await self._repo.list_dock_previews(shop_limit=cap)
        items: list[dict[str, Any]] = []
        for story, active_count in rows:
            payload = story_to_dict(story)
            shop = payload.get("shop") or {}
            items.append(
                {
                    "shop_id": str(story.shop_id),
                    "shop": shop,
                    "preview_story": payload,
                    "active_count": active_count,
                    "has_unseen": True,
                }
            )
        return items

    async def list_shop_stories(self, shop_id: UUID) -> list[StoryModel]:
        return await self._repo.list_live_for_shop(
            shop_id,
            limit=MAX_ACTIVE_STORIES_PER_SHOP,
        )

    async def active_count_for_shop(self, shop_id: UUID) -> int:
        return await self._repo.count_active_for_shop(shop_id)

    async def gc_expired_stories(self, *, batch_size: int | None = None) -> dict[str, int]:
        limit = batch_size or STORY_GC_BATCH_SIZE
        removed_files = 0
        removed_rows = 0
        errors = 0

        while True:
            batch = await self._repo.list_expired_batch(limit=limit)
            if not batch:
                break
            for story in batch:
                try:
                    if await delete_media_by_url(story.image_url):
                        removed_files += 1
                except Exception:
                    errors += 1
                await self._session.delete(story)
                removed_rows += 1
            await self._session.commit()
            if len(batch) < limit:
                break

        return {
            "removed_rows": removed_rows,
            "removed_files": removed_files,
            "errors": errors,
        }


def _extension_from_content_type(content_type: str) -> str:
    lowered = (content_type or "").lower()
    if "png" in lowered:
        return "png"
    if "webp" in lowered:
        return "webp"
    return "jpg"
