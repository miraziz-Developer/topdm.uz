from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.stories.service import StoryService
from app.infrastructure.db.session import get_db_session
from app.interfaces.api.serializers import story_to_dict

router = APIRouter(prefix="/market/stories", tags=["market-stories"])

_EMPTY = {
    "code": "no_live_stories",
    "title": "Hozircha jonli story yo'q",
    "message": "Do'konlar CRM orqali story yuklaganda shu yerda ko'rinadi.",
}


@router.get("/dock")
async def list_story_dock(
    limit: int = 15,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Bosh sahifa — do'konlar halqalari (har biri uchun 1 ta preview)."""
    service = StoryService(db)
    items = await service.list_dock(shop_limit=min(max(limit, 1), 30))
    if not items:
        return {"items": [], "empty_state": _EMPTY}
    return {"items": items, "empty_state": None}


@router.get("/shop/{shop_id}")
async def list_shop_stories(
    shop_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Bitta do'konning barcha faol storylari (max 3, eski → yangi)."""
    service = StoryService(db)
    stories = await service.list_shop_stories(shop_id)
    if not stories:
        return {
            "shop_id": str(shop_id),
            "shop": None,
            "items": [],
            "count": 0,
        }
    first = stories[0]
    shop_payload = story_to_dict(first).get("shop")
    return {
        "shop_id": str(shop_id),
        "shop": shop_payload,
        "items": [story_to_dict(s) for s in stories],
        "count": len(stories),
    }


@router.get("/live")
async def list_live_stories(
    limit: int = 40,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Legacy — tek ro'yxat (dock API afzal)."""
    service = StoryService(db)
    stories = await service.list_live_stories(limit=min(max(limit, 1), 60))
    items = [story_to_dict(s) for s in stories]
    if not items:
        return {"items": [], "empty_state": _EMPTY}
    return {"items": items, "empty_state": None}
