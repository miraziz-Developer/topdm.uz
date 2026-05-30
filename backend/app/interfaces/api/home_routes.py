from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.premium_banners.service import PremiumBannerService
from app.infrastructure.db.session import get_db_session

router = APIRouter(prefix="/home", tags=["home"])


@router.get("/premium-banners")
async def list_premium_banners(
    limit: int = 24,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = PremiumBannerService(db)
    return await service.get_home_carousel(limit=min(max(limit, 1), 60))


@router.post("/premium-banners/{banner_id}/impression")
async def track_banner_impression(
    banner_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if banner_id.startswith("fallback"):
        return {"status": "ok"}
    service = PremiumBannerService(db)
    try:
        await service.record_impression(UUID(banner_id))
    except Exception:
        pass
    return {"status": "ok"}


@router.post("/premium-banners/{banner_id}/click")
async def track_banner_click(
    banner_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if banner_id.startswith("fallback"):
        return {"status": "ok"}
    service = PremiumBannerService(db)
    try:
        await service.record_click(UUID(banner_id))
    except Exception:
        pass
    return {"status": "ok"}


class CreateSponsoredBannerBody(BaseModel):
    shop_id: UUID
    tariff_code: str = Field(..., pattern="^(bronze|silver|gold)$")
    image_url: str
    title: str | None = None
    product_id: UUID | None = None
    cta_path: str | None = None
    days: int = Field(default=30, ge=1, le=365)


@router.post("/premium-banners")
async def create_sponsored_banner(
    body: CreateSponsoredBannerBody,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from datetime import datetime, timedelta, timezone

    from app.infrastructure.db.models import ShopModel
    from app.infrastructure.repositories.premium_banner_repo import PremiumBannerRepository
    from app.models.premium_banner import SponsoredBannerModel

    shop = await db.get(ShopModel, body.shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    repo = PremiumBannerRepository(db)
    tariff = await repo.get_tariff_by_code(body.tariff_code)
    if not tariff:
        raise HTTPException(status_code=400, detail="Unknown tariff code")

    now = datetime.now(timezone.utc)
    days = body.days or int(tariff.duration_days or 30)
    banner = SponsoredBannerModel(
        shop_id=body.shop_id,
        tariff_id=tariff.id,
        title=body.title,
        image_url=body.image_url.strip(),
        product_id=body.product_id,
        cta_path=body.cta_path,
        status="active",
        is_active=True,
        package_days=days,
        amount_uzs=tariff.price_uzs_monthly,
        paid_at=now,
        payment_method="admin",
        starts_at=now,
        ends_at=now + timedelta(days=days),
    )
    created = await repo.create_banner(banner)
    await db.commit()
    from app.application.premium_banners.service import _banner_to_slide

    return {"status": "ok", "item": _banner_to_slide(created)}
