from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.merchant.shop_trust_service import ShopTrustService
from app.domain.schemas.shop_trust import StoreRatingMetrics, StoreReviewPayload
from app.infrastructure.auth.deps import require_merchant
from app.infrastructure.auth.merchant_resolve import resolve_merchant_shop
from app.infrastructure.auth.types import AuthUser
from app.infrastructure.db.session import get_db_session

router = APIRouter(prefix="/crm/shop", tags=["crm-shop-trust"])


async def _merchant_shop_id(
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> UUID:
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    return shop.id


class CrmStoreTrustResponse(BaseModel):
    store_rating_metrics: StoreRatingMetrics
    store_reviews: list[StoreReviewPayload]
    trust_metrics: dict


@router.get("/trust", response_model=CrmStoreTrustResponse)
async def crm_get_shop_trust(
    shop_id: UUID = Depends(_merchant_shop_id),
    db: AsyncSession = Depends(get_db_session),
) -> CrmStoreTrustResponse:
    service = ShopTrustService(db)
    try:
        payload = await service.get_crm_snapshot(shop_id)
        return CrmStoreTrustResponse(
            store_rating_metrics=StoreRatingMetrics.model_validate(payload["store_rating_metrics"]),
            store_reviews=[StoreReviewPayload.model_validate(r) for r in payload["store_reviews"]],
            trust_metrics=payload["trust_metrics"],
        )
    except ValueError as exc:
        if str(exc) == "shop_not_found":
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class PatchStoreRatingMetricsBody(BaseModel):
    order_fulfillment_rate: float | None = Field(None, ge=0.0, le=100.0)
    product_match_rate: float | None = Field(None, ge=0.0, le=100.0)
    average_response_time_min: int | None = Field(None, ge=0)
    quality_guarantee: bool | None = None
    badges: list[str] | None = None
    rating_distribution: dict[str, int] | None = None


@router.patch("/trust")
async def crm_patch_shop_trust(
    body: PatchStoreRatingMetricsBody,
    shop_id: UUID = Depends(_merchant_shop_id),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = ShopTrustService(db)
    try:
        return await service.patch_operational_kpis(shop_id, body.model_dump(exclude_none=True))
    except ValueError as exc:
        if str(exc) == "shop_not_found":
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc
