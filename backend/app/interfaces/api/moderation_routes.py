from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.merchant.ai_inspector import AIInspectorService
from app.infrastructure.db.session import get_db_session

router = APIRouter(prefix="/moderation", tags=["moderation"])


class PriceCheckBody(BaseModel):
    price_uzs: int = Field(..., gt=0, lt=100_000_000)
    category: str | None = None
    product_name: str | None = None


@router.post("/check-price")
async def check_product_price(body: PriceCheckBody, db: AsyncSession = Depends(get_db_session)) -> dict:
    inspector = AIInspectorService(db)
    result = await inspector.check_price(
        body.price_uzs,
        category=body.category,
        product_name=body.product_name,
    )
    return {
        "flagged": result.flagged,
        "message": result.message,
        "median_uzs": result.median_uzs,
        "ratio": result.ratio,
        "price_uzs": result.price_uzs,
    }
