from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.crm_banners.purchase import BannerPurchaseService
from app.application.crm_banners.service import CrmBannerService
from app.infrastructure.cache.premium_carousel_cache import PremiumCarouselCache
from app.infrastructure.auth.deps import require_merchant
from app.infrastructure.auth.merchant_resolve import resolve_merchant_shop
from app.infrastructure.auth.types import AuthUser
from app.infrastructure.db.session import get_db_session

router = APIRouter(prefix="/crm/banners", tags=["crm-banners"])


async def _merchant_shop_id(
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> UUID:
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    return shop.id


def _map_service_error(exc: ValueError) -> HTTPException:
    code = str(exc)
    status = 400
    if code in {"banner_not_found"}:
        status = 404
    elif code in {"insufficient_coins", "Insufficient Coin Balance"}:
        status = 400
        code = "Insufficient Coin Balance"
    return HTTPException(status_code=status, detail=code)


@router.get("/tariffs")
async def crm_list_tariffs(
    db: AsyncSession = Depends(get_db_session),
    _: UUID = Depends(_merchant_shop_id),
) -> dict:
    service = CrmBannerService(db)
    items = await service.list_tariffs()
    return {"items": items}


@router.get("/wallet")
async def crm_merchant_wallet(
    shop_id: UUID = Depends(_merchant_shop_id),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = CrmBannerService(db)
    return await service.get_wallet(shop_id)


@router.get("/mine")
async def crm_list_my_banners(
    shop_id: UUID = Depends(_merchant_shop_id),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = CrmBannerService(db)
    return await service.list_shop_campaigns(shop_id)


@router.post("/create")
async def crm_create_banner(
    tariff_code: str = Form(..., pattern="^(bronze|silver|gold)$"),
    title: str | None = Form(None),
    image_url: str | None = Form(None),
    product_id: UUID | None = Form(None),
    cta_path: str | None = Form(None),
    image: UploadFile | None = File(None),
    shop_id: UUID = Depends(_merchant_shop_id),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = CrmBannerService(db)
    image_bytes: bytes | None = None
    content_type = "image/jpeg"
    extension = "jpg"
    if image and image.filename:
        image_bytes = await image.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="empty_image")
        content_type = image.content_type or "image/jpeg"
        if "png" in content_type:
            extension = "png"
        elif "webp" in content_type:
            extension = "webp"

    try:
        return await service.create_pending_banner(
            shop_id=shop_id,
            tariff_code=tariff_code,
            image_bytes=image_bytes,
            image_url=image_url,
            title=title,
            product_id=product_id,
            cta_path=cta_path,
            content_type=content_type,
            extension=extension,
        )
    except ValueError as exc:
        raise _map_service_error(exc) from exc


class VerifyPaymentBody(BaseModel):
    banner_id: UUID
    payment_method: str = Field(..., pattern="^(coin|click|payme)$")
    external_reference: str | None = None


@router.post("/verify-payment")
async def crm_verify_payment(
    body: VerifyPaymentBody,
    shop_id: UUID = Depends(_merchant_shop_id),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = CrmBannerService(db)
    try:
        return await service.verify_payment(
            shop_id=shop_id,
            banner_id=body.banner_id,
            payment_method=body.payment_method,
            external_reference=body.external_reference,
        )
    except ValueError as exc:
        raise _map_service_error(exc) from exc


class RenewBannerBody(BaseModel):
    banner_id: UUID
    tariff_code: str | None = Field(None, pattern="^(bronze|silver|gold)$")


@router.post("/renew")
async def crm_renew_banner(
    body: RenewBannerBody,
    shop_id: UUID = Depends(_merchant_shop_id),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = CrmBannerService(db)
    try:
        return await service.renew_banner(
            shop_id=shop_id,
            banner_id=body.banner_id,
            tariff_code=body.tariff_code,
        )
    except ValueError as exc:
        raise _map_service_error(exc) from exc


async def _purchase_banner_handler(
    *,
    shop_id: UUID,
    db: AsyncSession,
    tariff_code: str,
    title: str | None,
    image_url: str | None,
    product_id: UUID | None,
    cta_path: str | None,
    image: UploadFile | None,
) -> dict:
    service = BannerPurchaseService(db)
    image_bytes: bytes | None = None
    if image and image.filename:
        image_bytes = await image.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="empty_image")
    try:
        return await service.purchase_with_coins(
            shop_id=shop_id,
            tariff_code=tariff_code,
            image_bytes=image_bytes,
            image_url=image_url,
            title=title,
            product_id=product_id,
            cta_path=cta_path,
        )
    except ValueError as exc:
        raise _map_service_error(exc) from exc


@router.post("/purchase")
async def crm_purchase_banner(
    tariff_code: str = Form(..., pattern="^(bronze|silver|gold)$"),
    title: str | None = Form(None),
    image_url: str | None = Form(None),
    product_id: UUID | None = Form(None),
    cta_path: str | None = Form(None),
    image: UploadFile | None = File(None),
    shop_id: UUID = Depends(_merchant_shop_id),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    return await _purchase_banner_handler(
        shop_id=shop_id,
        db=db,
        tariff_code=tariff_code,
        title=title,
        image_url=image_url,
        product_id=product_id,
        cta_path=cta_path,
        image=image,
    )


@router.post("/buy-with-coins")
async def crm_buy_banner_with_coins(
    tariff_code: str = Form(..., pattern="^(bronze|silver|gold)$"),
    title: str | None = Form(None),
    image_url: str | None = Form(None),
    product_id: UUID | None = Form(None),
    cta_path: str | None = Form(None),
    image: UploadFile | None = File(None),
    shop_id: UUID = Depends(_merchant_shop_id),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    return await _purchase_banner_handler(
        shop_id=shop_id,
        db=db,
        tariff_code=tariff_code,
        title=title,
        image_url=image_url,
        product_id=product_id,
        cta_path=cta_path,
        image=image,
    )


class CarouselSettingsBody(BaseModel):
    enabled: bool | None = None
    crossfade: bool | None = None
    autoplay: bool | None = None
    interval_ms: int | None = Field(None, ge=2000, le=15000)


@router.get("/carousel-settings")
async def get_carousel_settings(_: UUID = Depends(_merchant_shop_id)) -> dict:
    cache = PremiumCarouselCache()
    config = await cache.get_config()
    version = await cache.get_version()
    return {"carousel": config, "version": version}


@router.patch("/carousel-settings")
async def patch_carousel_settings(
    body: CarouselSettingsBody,
    _: UUID = Depends(_merchant_shop_id),
) -> dict:
    cache = PremiumCarouselCache()
    config = await cache.set_config(body.model_dump(exclude_none=True))
    version = await cache.bump_invalidation()
    return {"carousel": config, "version": version}


@router.get("/{banner_id}/stats")
async def crm_banner_stats(
    banner_id: UUID,
    shop_id: UUID = Depends(_merchant_shop_id),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = CrmBannerService(db)
    try:
        return await service.get_banner_stats(shop_id, banner_id)
    except ValueError as exc:
        raise _map_service_error(exc) from exc
