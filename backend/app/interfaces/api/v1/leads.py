from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import ProductLeadEventModel
from app.infrastructure.db.session import get_db_session
from app.interfaces.schemas.leads import LeadTrackRequest

router = APIRouter(prefix="/leads", tags=["leads"])


@router.post("/track")
async def track_lead(
    payload: LeadTrackRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    event = ProductLeadEventModel(
        product_id=payload.product_id,
        user_id=payload.user_id,
        source=payload.source,
        event_metadata=payload.metadata,
    )
    db.add(event)
    await db.commit()
    return {"status": "ok", "lead_id": str(event.id)}
