from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.stories.service import StoryService, build_level_context
from app.infrastructure.auth.deps import AuthUser, require_merchant
from app.infrastructure.auth.merchant_resolve import resolve_merchant_shop
from app.infrastructure.db.session import get_db_session
from app.interfaces.api.serializers import story_to_dict

router = APIRouter(prefix="/merchants/stories", tags=["merchant-stories"])

_MAX_BYTES = 8 * 1024 * 1024


@router.post("")
async def create_merchant_story(
    file: UploadFile = File(...),
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if not user.shop_id:
        raise HTTPException(status_code=403, detail="Merchant shop not found")

    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty image file")
    if len(raw) > _MAX_BYTES:
        raise HTTPException(status_code=400, detail="Image must be 8MB or smaller")

    content_type = (file.content_type or "image/jpeg").lower()
    if content_type and not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are supported")

    level_context = build_level_context(floor=shop.floor, section=shop.section)
    service = StoryService(db)
    story = await service.publish_story(
        shop_id=user.shop_id,
        image_bytes=raw,
        content_type=content_type,
        level_context=level_context,
    )
    return {"item": story_to_dict(story)}
