from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
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


@router.get("")
async def list_shop_reviews_for_moderation(
    status: str = "pending_moderation",
    limit: int = 50,
    offset: int = 0,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop_id = await _shop_id(user, db)
    svc = ProductReviewService(db)
    return await svc.list_for_moderation(shop_id, status=status, limit=limit, offset=offset)


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
