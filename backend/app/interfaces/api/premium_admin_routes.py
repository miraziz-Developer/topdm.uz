from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.premium_banners.service import PremiumBannerService, _banner_to_slide
from app.infrastructure.db.session import get_db_session
from app.infrastructure.repositories.premium_banner_repo import PremiumBannerRepository
from app.interfaces.api.admin_routes import require_admin_key
from app.models.premium_banner import PremiumTariffModel, SponsoredBannerModel

router = APIRouter(prefix="/admin/premium", tags=["admin-premium"])


@router.get("/tariffs")
async def list_tariffs(
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    result = await db.execute(select(PremiumTariffModel).order_by(PremiumTariffModel.priority_weight.desc()))
    rows = result.scalars().all()
    return {
        "items": [
            {
                "id": str(t.id),
                "code": t.code,
                "name_uz": t.name_uz,
                "priority_weight": t.priority_weight,
                "dwell_ms": t.dwell_ms,
                "badge_label": t.badge_label,
                "frame_style": t.frame_style,
                "price_uzs_monthly": float(t.price_uzs_monthly) if t.price_uzs_monthly else None,
                "is_active": t.is_active,
            }
            for t in rows
        ]
    }


class AdminCreateBannerBody(BaseModel):
    shop_id: UUID
    tariff_code: str = Field(..., pattern="^(bronze|silver|gold)$")
    image_url: str
    title: str | None = None
    product_id: UUID | None = None
    cta_path: str | None = None
    days: int = Field(default=30, ge=1, le=365)


@router.post("/banners")
async def admin_create_banner(
    body: AdminCreateBannerBody,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.infrastructure.db.models import ShopModel

    shop = await db.get(ShopModel, body.shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    repo = PremiumBannerRepository(db)
    tariff = await repo.get_tariff_by_code(body.tariff_code)
    if not tariff:
        raise HTTPException(status_code=400, detail="Unknown tariff")

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
    return {"status": "ok", "item": _banner_to_slide(created)}


@router.get("/banners")
async def admin_list_banners(
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    repo = PremiumBannerRepository(db)
    rows = await repo.list_active_banners(limit=100)
    return {"items": [_banner_to_slide(b) for b in rows]}


class AdminWalletCreditBody(BaseModel):
    coin_amount: int = Field(..., ge=1, le=1_000_000)


@router.post("/wallets/{shop_id}/credit")
async def admin_credit_wallet(
    shop_id: UUID,
    body: AdminWalletCreditBody,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.infrastructure.db.models import ShopModel
    shop = await db.get(ShopModel, shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    from app.infrastructure.repositories.wallet_repo import WalletRepository

    wallet_repo = WalletRepository(db)
    shop = await wallet_repo.lock_shop(shop_id)
    shop.coins_balance = int(shop.coins_balance or 0) + body.coin_amount
    await wallet_repo.sync_legacy_wallet(shop_id, int(shop.coins_balance))
    await db.commit()
    return {"shop_id": str(shop_id), "coin_balance": shop.coins_balance, "coins_balance": shop.coins_balance}
