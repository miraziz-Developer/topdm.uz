from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.merchant.shop_branding import MerchantShopBrandingService, ShopBrandingError
from app.infrastructure.auth.deps import AuthUser, require_merchant
from app.infrastructure.auth.merchant_resolve import resolve_merchant_shop
from app.infrastructure.db.session import get_db_session

router = APIRouter(tags=["merchant-shop"])

_MAX_IMAGE_BYTES = 5 * 1024 * 1024


async def _shop_or_404(db: AsyncSession, user: AuthUser):
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


async def _read_image(file: UploadFile) -> tuple[bytes, str]:
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Rasm bo'sh")
    if len(raw) > _MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Rasm 5 MB dan kichik bo'lishi kerak")
    content_type = (file.content_type or "image/jpeg").lower()
    if content_type and not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Faqat rasm fayli")
    return raw, content_type


class MerchantShopProfilePatch(BaseModel):
    description: str | None = Field(default=None, max_length=2000)


@router.patch("/merchant/shop/profile")
async def patch_merchant_shop_profile(
    payload: MerchantShopProfilePatch,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await _shop_or_404(db, user)
    svc = MerchantShopBrandingService(db)
    try:
        profile = await svc.update_description(shop.id, description=payload.description)
    except ShopBrandingError as exc:
        raise HTTPException(status_code=404, detail=exc.code) from exc
    return {"shop": profile}


@router.post("/merchant/shop/logo")
async def upload_merchant_shop_logo(
    file: UploadFile = File(...),
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await _shop_or_404(db, user)
    raw, content_type = await _read_image(file)
    svc = MerchantShopBrandingService(db)
    try:
        profile = await svc.upload_logo(shop.id, image_bytes=raw, content_type=content_type)
    except ShopBrandingError as exc:
        status = 400 if exc.code == "image_required" else 404
        raise HTTPException(status_code=status, detail=exc.message) from exc
    return {"shop": profile}


@router.post("/merchant/shop/cover")
async def upload_merchant_shop_cover(
    file: UploadFile = File(...),
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await _shop_or_404(db, user)
    raw, content_type = await _read_image(file)
    svc = MerchantShopBrandingService(db)
    try:
        profile = await svc.upload_storefront(shop.id, image_bytes=raw, content_type=content_type)
    except ShopBrandingError as exc:
        status = 400 if exc.code == "image_required" else 404
        raise HTTPException(status_code=status, detail=exc.message) from exc
    return {"shop": profile}
