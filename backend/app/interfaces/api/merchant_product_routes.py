from __future__ import annotations

import json
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.merchant.catalog_product_service import CatalogProductError, MerchantCatalogProductService
from app.application.merchant.schemas import (
    MerchantProductUpdateRequest,
    ProductVariantCatalogInput,
    WholesalePackInput,
)
from app.application.marketplace.use_cases import MarketplaceUseCases
from app.infrastructure.auth.deps import AuthUser, require_merchant
from app.infrastructure.auth.merchant_resolve import resolve_merchant_shop
from app.infrastructure.db.session import get_db_session
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.interfaces.api.platform_routes import FeaturedUpdateRequest, marketplace_use_case
from app.interfaces.api.serializers import product_to_dict

router = APIRouter(tags=["merchant-products"])

_MAX_IMAGE_BYTES = 8 * 1024 * 1024


async def _shop_or_404(db: AsyncSession, user: AuthUser):
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


from app.core.upload_validation import validate_image_bytes


async def _read_image(file: UploadFile) -> tuple[bytes, str]:
    raw = await file.read()
    content_type = validate_image_bytes(raw, max_bytes=_MAX_IMAGE_BYTES)
    return raw, content_type


def _parse_wholesale_json(raw: str | None) -> WholesalePackInput | None:
    if not raw or not raw.strip():
        return None
    try:
        data = json.loads(raw)
        return WholesalePackInput.model_validate(data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="wholesale_json noto'g'ri") from exc


def _parse_variant_json(raw: str | None) -> ProductVariantCatalogInput | None:
    if not raw or not raw.strip():
        return None
    try:
        data = json.loads(raw)
        return ProductVariantCatalogInput.model_validate(data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="variant_json noto'g'ri") from exc


def _parse_image_meta(raw: str | None, count: int) -> list[str | None]:
    if not raw or not raw.strip():
        return [None] * count
    try:
        data = json.loads(raw)
        if not isinstance(data, list):
            return [None] * count
        out: list[str | None] = []
        for i in range(count):
            item = data[i] if i < len(data) else None
            out.append(str(item).strip() if item else None)
        return out
    except Exception:
        return [None] * count


@router.get("/merchant/products")
async def merchant_list_products(
    include_hidden: bool = Query(default=True),
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await _shop_or_404(db, user)
    repo = MarketplaceRepository(db)
    products = await repo.list_shop_products(
        shop.id,
        limit=200,
        offset=0,
        include_unavailable=include_hidden,
    )
    return {"items": [product_to_dict(product, for_merchant=True) for product in products]}


@router.get("/merchant/products/{product_id}")
async def merchant_get_product(
    product_id: UUID,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await _shop_or_404(db, user)
    service = MerchantCatalogProductService(db)
    try:
        return {"item": await service.get_product(shop.id, product_id)}
    except CatalogProductError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/merchant/products")
async def merchant_create_product(
    files: list[UploadFile] = File(...),
    name: str = Form(..., min_length=2, max_length=300),
    price: int = Form(..., gt=0, lt=100_000_000),
    description: str | None = Form(default=None),
    stock_count: int = Form(default=5, ge=0, le=99999),
    is_featured: bool = Form(default=False),
    variant_json: str | None = Form(default=None),
    wholesale_json: str | None = Form(default=None),
    sale_type: str | None = Form(default=None),
    pricing_unit: str | None = Form(default=None),
    min_order_quantity: int = Form(default=1, ge=1, le=999),
    units_per_pack: int | None = Form(default=None),
    image_meta: str | None = Form(default=None),
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await _shop_or_404(db, user)
    if not files:
        raise HTTPException(status_code=400, detail="Kamida bitta rasm kerak")

    parsed_files: list[tuple[bytes, str]] = []
    for f in files:
        parsed_files.append(await _read_image(f))

    colors_meta = _parse_image_meta(image_meta, len(parsed_files))
    first_raw, first_ct = parsed_files[0]
    extra: list[tuple[bytes, str, str | None]] = []
    for i in range(1, len(parsed_files)):
        extra.append((parsed_files[i][0], parsed_files[i][1], colors_meta[i]))

    service = MerchantCatalogProductService(db)
    try:
        item = await service.create_product(
            shop.id,
            name=name,
            price=price,
            description=description,
            stock_count=stock_count,
            is_featured=is_featured,
            image_bytes=first_raw,
            content_type=first_ct,
            variant_catalog=_parse_variant_json(variant_json),
            extra_image_bytes=extra or None,
            sale_type=sale_type,
            pricing_unit=pricing_unit,
            min_order_quantity=min_order_quantity,
            units_per_pack=units_per_pack,
            wholesale_pack=_parse_wholesale_json(wholesale_json),
        )
        return {"item": item}
    except CatalogProductError as exc:
        status = 400 if exc.code != "not_found" else 404
        raise HTTPException(status_code=status, detail=str(exc)) from exc


@router.patch("/merchant/products/{product_id}")
async def merchant_update_product(
    product_id: UUID,
    payload: MerchantProductUpdateRequest,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await _shop_or_404(db, user)
    service = MerchantCatalogProductService(db)
    try:
        item = await service.update_product(shop.id, product_id, payload)
        return {"item": item}
    except CatalogProductError as exc:
        status = 404 if exc.code == "not_found" else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc


@router.post("/merchant/products/{product_id}/images")
async def merchant_upload_product_images(
    product_id: UUID,
    files: list[UploadFile] = File(...),
    image_meta: str | None = Form(default=None),
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await _shop_or_404(db, user)
    if not files:
        raise HTTPException(status_code=400, detail="Rasm tanlang")
    colors_meta = _parse_image_meta(image_meta, len(files))
    items: list[tuple[bytes, str, str | None]] = []
    for i, f in enumerate(files):
        raw, ctype = await _read_image(f)
        items.append((raw, ctype, colors_meta[i]))
    service = MerchantCatalogProductService(db)
    try:
        item = await service.upload_images(shop.id, product_id, items=items)
        return {"item": item}
    except CatalogProductError as exc:
        status = 404 if exc.code == "not_found" else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc


@router.post("/merchant/products/{product_id}/image")
async def merchant_replace_product_image(
    product_id: UUID,
    file: UploadFile = File(...),
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await _shop_or_404(db, user)
    image_bytes, content_type = await _read_image(file)
    service = MerchantCatalogProductService(db)
    try:
        item = await service.replace_image(
            shop.id,
            product_id,
            image_bytes=image_bytes,
            content_type=content_type,
        )
        return {"item": item}
    except CatalogProductError as exc:
        status = 404 if exc.code == "not_found" else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc


@router.delete("/merchant/products/{product_id}")
async def merchant_delete_product(
    product_id: UUID,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await _shop_or_404(db, user)
    service = MerchantCatalogProductService(db)
    try:
        return await service.delete_product(shop.id, product_id)
    except CatalogProductError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/merchant/products/{product_id}/featured")
async def merchant_set_featured(
    product_id: UUID,
    payload: FeaturedUpdateRequest,
    user: AuthUser = Depends(require_merchant),
    use_case: MarketplaceUseCases = Depends(marketplace_use_case),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    shop = await _shop_or_404(db, user)
    try:
        return await use_case.set_product_featured(shop_id=shop.id, product_id=product_id, featured=payload.featured)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
