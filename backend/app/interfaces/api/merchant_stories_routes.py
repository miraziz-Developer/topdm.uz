from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.stories.constants import MAX_ACTIVE_STORIES_PER_SHOP
from app.application.stories.errors import StoryLimitError
from app.application.stories.service import StoryService, build_level_context
from app.core.upload_validation import validate_image_bytes
from app.infrastructure.auth.deps import AuthUser, require_merchant
from app.infrastructure.auth.merchant_resolve import resolve_merchant_shop
from app.infrastructure.db.session import get_db_session
from app.interfaces.api.serializers import story_to_dict

router = APIRouter(prefix="/merchants/stories", tags=["merchant-stories"])

_MAX_BYTES = 8 * 1024 * 1024


async def _merchant_shop(db: AsyncSession, user: AuthUser):
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    user.shop_id = shop.id
    return shop


@router.get("")
async def list_merchant_stories(
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await _merchant_shop(db, user)
    service = StoryService(db)
    stories = await service.list_shop_stories(shop.id)
    return {"items": [story_to_dict(s) for s in stories]}


@router.post("")
async def create_merchant_story(
    file: UploadFile = File(...),
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await _merchant_shop(db, user)

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty image file")
    content_type = validate_image_bytes(raw, max_bytes=_MAX_BYTES, label="Story rasm")

    level_context = build_level_context(floor=shop.floor, section=shop.section)
    service = StoryService(db)
    try:
        story = await service.publish_story(
            shop_id=shop.id,
            image_bytes=raw,
            content_type=content_type,
            level_context=level_context,
        )
    except StoryLimitError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "story_limit_reached",
                "message": str(exc),
                "active_count": exc.active_count,
                "limit": exc.limit,
            },
        ) from exc
    active = await service.active_count_for_shop(shop.id)
    return {
        "item": story_to_dict(story),
        "active_count": active,
        "limit": MAX_ACTIVE_STORIES_PER_SHOP,
    }


@router.delete("/{story_id}")
async def delete_merchant_story(
    story_id: UUID,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await _merchant_shop(db, user)

    service = StoryService(db)
    deleted = await service.delete_story(shop.id, story_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Story topilmadi")
    active = await service.active_count_for_shop(shop.id)
    return {
        "story_id": str(story_id),
        "deleted": True,
        "active_count": active,
        "limit": MAX_ACTIVE_STORIES_PER_SHOP,
    }
