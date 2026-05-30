from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.merchant.product_service import MerchantProductService, PublishPendingProductError
from app.application.merchant.schemas import (
    PublishPendingProductRequest,
    RejectPendingProductRequest,
)
from app.core.config import get_settings
from app.infrastructure.auth.deps import AuthUser, require_merchant
from app.infrastructure.db.session import get_db_session
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway

router = APIRouter(prefix="/merchant/pending-products", tags=["merchant-pending"])


def _service(db: AsyncSession) -> MerchantProductService:
    settings = get_settings()
    notifier = TelegramNotifierGateway(settings.telegram_bot_token) if settings.telegram_bot_token else None
    return MerchantProductService(db, notifier=notifier)


def _map_error(exc: PublishPendingProductError) -> HTTPException:
    code_map = {
        "not_found": 404,
        "embedding_failed": 502,
        "image_failed": 422,
        "invalid_price": 422,
        "invalid_name": 422,
    }
    return HTTPException(
        status_code=code_map.get(exc.code, 400),
        detail={"code": exc.code, "message": str(exc)},
    )


@router.get("")
async def list_pending_products(
    status: str = "pending",
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if not user.shop_id:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    service = _service(db)
    items = await service.list_pending(user.shop_id, status=status)
    return {"items": [i.model_dump(mode="json") for i in items]}


@router.post("/{pending_id}/publish")
async def publish_pending_product(
    pending_id: UUID,
    body: PublishPendingProductRequest,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if not user.shop_id:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    service = _service(db)
    try:
        result = await service.publish_pending_product(pending_id, shop_id=user.shop_id, payload=body)
    except PublishPendingProductError as exc:
        raise _map_error(exc) from exc
    return result.model_dump(mode="json")


@router.post("/{pending_id}/reject")
async def reject_pending_product(
    pending_id: UUID,
    body: RejectPendingProductRequest,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if not user.shop_id:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    service = _service(db)
    try:
        item = await service.reject_pending_product(pending_id, shop_id=user.shop_id, payload=body)
    except PublishPendingProductError as exc:
        raise _map_error(exc) from exc
    return {"item": item.model_dump(mode="json")}


@router.patch("/{pending_id}")
async def edit_pending_product(
    pending_id: UUID,
    body: PublishPendingProductRequest,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if not user.shop_id:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    service = _service(db)
    patch: dict = {}
    if body.name:
        patch["product_name"] = body.name
    if body.price_uzs is not None:
        patch["price_uzs"] = body.price_uzs
    if body.description:
        patch["description"] = body.description
    try:
        item = await service.update_pending_draft(pending_id, shop_id=user.shop_id, vision_patch=patch)
    except PublishPendingProductError as exc:
        raise _map_error(exc) from exc
    return {"item": item.model_dump(mode="json")}
