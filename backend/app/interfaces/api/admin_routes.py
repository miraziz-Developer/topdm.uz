from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.market_analytics import AdminMarketAnalyticsService
from app.core.config import get_settings
from app.infrastructure.db.session import get_db_session
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.interfaces.api.serializers import shop_to_dict

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin_key(x_admin_key: str | None = Header(default=None, alias="X-Admin-Key")) -> None:
    settings = get_settings()
    if not settings.admin_api_key:
        raise HTTPException(status_code=503, detail="ADMIN_API_KEY is not configured")
    if not x_admin_key or x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=401, detail="Invalid admin key")


@router.get("/analytics/markets/{market_slug}")
async def admin_market_analytics(
    market_slug: str,
    days: int = 7,
    level: int = 1,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = AdminMarketAnalyticsService(db)
    report = await service.build_report(market_slug, days=days, level=level)
    return report.to_dict()


class FeaturedShopBody(BaseModel):
    featured: bool = True
    days: int = 30


@router.patch("/shops/{shop_id}/featured")
async def admin_set_shop_featured(
    shop_id: UUID,
    body: FeaturedShopBody,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from datetime import datetime, timedelta, timezone

    from app.infrastructure.db.models import ShopModel

    shop = await db.get(ShopModel, shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    shop.is_featured = body.featured
    shop.featured_until = (
        datetime.now(timezone.utc) + timedelta(days=body.days) if body.featured else None
    )
    await db.commit()
    await db.refresh(shop)
    return shop_to_dict(shop)


@router.get("/shops/pending")
async def admin_list_pending_shops(
    limit: int = 50,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.infrastructure.db.models import ShopModel

    result = await db.execute(
        select(ShopModel)
        .where(ShopModel.is_active == True, ShopModel.is_verified == False)
        .order_by(ShopModel.name.asc())
        .limit(min(limit, 200))
    )
    shops = list(result.scalars().all())
    return {"items": [shop_to_dict(s) for s in shops], "count": len(shops)}


class VerifyShopBody(BaseModel):
    verified: bool = True


@router.get("/shops/{shop_id}/share-kit")
async def admin_shop_share_kit(
    shop_id: UUID,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.application.merchant.share_kit import build_share_kit
    from app.application.merchant.workspace_draft import load_workspace_draft
    from app.core.config import get_settings
    from app.infrastructure.db.models import ShopModel

    shop = await db.get(ShopModel, shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    draft = await load_workspace_draft(shop_id)
    hours = draft.get("operating_hours") or {"open": "09:00", "close": "20:00", "busy_note": ""}
    return build_share_kit(shop, settings=get_settings(), operating_hours=hours)


@router.patch("/shops/{shop_id}/verify")
async def admin_verify_shop(
    shop_id: UUID,
    body: VerifyShopBody,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.infrastructure.db.models import ShopModel

    shop = await db.get(ShopModel, shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    shop.is_verified = body.verified
    await db.commit()
    await db.refresh(shop)
    return shop_to_dict(shop)
