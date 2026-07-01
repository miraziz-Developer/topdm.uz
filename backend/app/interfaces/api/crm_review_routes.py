from __future__ import annotations

from datetime import datetime, time, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.marketplace.product_review_service import ProductReviewService
from app.infrastructure.auth.deps import require_merchant
from app.infrastructure.auth.merchant_resolve import resolve_merchant_shop
from app.infrastructure.auth.types import AuthUser
from app.infrastructure.db.session import get_db_session

router = APIRouter(prefix="/crm/reviews", tags=["crm-reviews"])


class ReviewModerationBody(BaseModel):
    action: str = Field(..., pattern="^(approve|reject)$")
    note: str | None = None


async def _shop_id(user: AuthUser, db: AsyncSession) -> UUID:
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    return shop.id


def _parse_date_start(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        day = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if day.tzinfo is None:
            day = day.replace(tzinfo=timezone.utc)
        return datetime.combine(day.date(), time.min, tzinfo=timezone.utc)
    except ValueError:
        return None


def _parse_date_end(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        day = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if day.tzinfo is None:
            day = day.replace(tzinfo=timezone.utc)
        return datetime.combine(day.date(), time.max, tzinfo=timezone.utc)
    except ValueError:
        return None


@router.get("")
async def list_shop_reviews_for_moderation(
    status: str = Query(default="all"),
    product_id: UUID | None = None,
    rating: int | None = Query(default=None, ge=1, le=5),
    rating_min: int | None = Query(default=None, ge=1, le=5),
    date_from: str | None = Query(default=None, description="ISO date YYYY-MM-DD"),
    date_to: str | None = Query(default=None, description="ISO date YYYY-MM-DD"),
    q: str | None = Query(default=None, max_length=120),
    verified_only: bool = False,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop_id = await _shop_id(user, db)
    svc = ProductReviewService(db)
    try:
        return await svc.list_for_moderation(
            shop_id,
            status=status,
            limit=limit,
            offset=offset,
            product_id=product_id,
            rating=rating,
            rating_min=rating_min,
            date_from=_parse_date_start(date_from),
            date_to=_parse_date_end(date_to),
            q=q,
            verified_only=verified_only,
        )
    except ValueError as exc:
        if str(exc) == "invalid_status":
            raise HTTPException(status_code=400, detail="invalid_status") from exc
        raise


@router.post("/{review_id}/action")
async def moderate_review(
    review_id: UUID,
    body: ReviewModerationBody,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop_id = await _shop_id(user, db)
    svc = ProductReviewService(db)
    try:
        return await svc.moderate_review(
            shop_id,
            review_id,
            action=body.action,
            note=body.note,
        )
    except ValueError as exc:
        code = str(exc)
        status = 404 if code in {"review_not_found", "shop_mismatch"} else 400
        raise HTTPException(status_code=status, detail=code) from exc
