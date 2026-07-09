from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.premium_banners.service import PremiumBannerService, _banner_to_admin_item, _banner_to_slide
from app.core.upload_validation import validate_image_bytes
from app.infrastructure.db.session import get_db_session
from app.infrastructure.repositories.premium_banner_repo import PremiumBannerRepository
from app.infrastructure.storage.object_store import ObjectMediaStore
from app.interfaces.api.admin_routes import require_admin_key
from app.models.premium_banner import PremiumTariffModel, SponsoredBannerModel

router = APIRouter(prefix="/admin/premium", tags=["admin-premium"])

_MAX_IMAGE_BYTES = 5 * 1024 * 1024


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
                "coin_cost": int(t.coin_cost) if t.coin_cost is not None else None,
                "duration_days": int(t.duration_days) if t.duration_days is not None else None,
                "is_active": t.is_active,
            }
            for t in rows
        ]
    }


class AdminUpdateTariffBody(BaseModel):
    name_uz: str | None = Field(default=None, min_length=2, max_length=120)
    priority_weight: int | None = Field(default=None, ge=1, le=10)
    dwell_ms: int | None = Field(default=None, ge=1000, le=30_000)
    badge_label: str | None = Field(default=None, max_length=40)
    price_uzs_monthly: float | None = Field(default=None, ge=0)
    coin_cost: int | None = Field(default=None, ge=0)
    duration_days: int | None = Field(default=None, ge=1, le=365)
    is_active: bool | None = None


@router.patch("/tariffs/{tariff_id}")
async def update_tariff(
    tariff_id: UUID,
    body: AdminUpdateTariffBody,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    row = await db.get(PremiumTariffModel, tariff_id)
    if not row:
        raise HTTPException(status_code=404, detail="Tariff not found")
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    for key, value in updates.items():
        setattr(row, key, value)
    await db.commit()
    await db.refresh(row)
    return {
        "id": str(row.id),
        "code": row.code,
        "name_uz": row.name_uz,
        "priority_weight": row.priority_weight,
        "dwell_ms": row.dwell_ms,
        "badge_label": row.badge_label,
        "frame_style": row.frame_style,
        "price_uzs_monthly": float(row.price_uzs_monthly) if row.price_uzs_monthly else None,
        "coin_cost": row.coin_cost,
        "duration_days": row.duration_days,
        "is_active": row.is_active,
    }


@router.post("/upload-image")
async def admin_upload_banner_image(
    shop_id: UUID = Form(...),
    file: UploadFile = File(...),
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.infrastructure.db.models import ShopModel

    shop = await db.get(ShopModel, shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    raw = await file.read()
    validate_image_bytes(raw, max_bytes=_MAX_IMAGE_BYTES, label="Rasm")

    from app.application.media.banner_image_processor import process_banner_upload

    processed = process_banner_upload(raw)
    media = ObjectMediaStore()
    url = await media.save_banner_image(
        shop_id=shop_id,
        image_bytes=processed.data,
        extension=processed.extension,
        content_type=processed.content_type,
    )
    return {"image_url": url, "width": processed.width, "height": processed.height}


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

    image_url = body.image_url.strip()
    if not image_url:
        raise HTTPException(status_code=400, detail="image_url required")

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
        image_url=image_url,
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
    from app.infrastructure.cache.premium_carousel_cache import PremiumCarouselCache

    await PremiumCarouselCache().bump_invalidation()
    return {"status": "ok", "item": _banner_to_admin_item(created)}


@router.get("/banners")
async def admin_list_banners(
    active_only: bool = False,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    repo = PremiumBannerRepository(db)
    if active_only:
        rows = await repo.list_active_banners(limit=100)
        return {"items": [_banner_to_admin_item(b) for b in rows]}
    rows = await repo.list_admin_banners(limit=100)
    return {"items": [_banner_to_admin_item(b) for b in rows]}


@router.patch("/banners/{banner_id}/deactivate")
async def admin_deactivate_banner(
    banner_id: UUID,
    _: None = Depends(require_admin_key),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    repo = PremiumBannerRepository(db)
    banner = await repo.get_banner(banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")
    if banner.status != "active" or not banner.is_active:
        raise HTTPException(status_code=400, detail="Banner is not active")

    now = datetime.now(timezone.utc)
    banner.status = "cancelled"
    banner.is_active = False
    banner.updated_at = now
    await db.commit()

    from app.infrastructure.cache.premium_carousel_cache import PremiumCarouselCache

    await PremiumCarouselCache().bump_invalidation()
    return {"status": "ok", "id": str(banner_id)}


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
