from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.stories.service import StoryService
from app.infrastructure.db.session import get_db_session
from app.interfaces.api.serializers import story_to_dict

router = APIRouter(prefix="/market/stories", tags=["market-stories"])


@router.get("/live")
async def list_live_stories(
    limit: int = 40,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = StoryService(db)
    stories = await service.list_live_stories(limit=min(max(limit, 1), 60))
    return {"items": [story_to_dict(s) for s in stories]}
