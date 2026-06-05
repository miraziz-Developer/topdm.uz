from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.topdmbozor.order_service import TopdmbozorOrderError, TopdmbozorOrderService
from app.application.topdmbozor.payment_webhook_service import (
    PaymentWebhookError,
    PaymentWebhookService,
    verify_sms_webhook_signature,
)
from app.infrastructure.db.session import get_db_session
from app.infrastructure.repositories.topdmbozor_repo import TopdmbozorRepository
from app.infrastructure.tasks.topdmbozor_tasks import poll_single_order_tracking
from app.schemas.topdmbozor import (
    CreateMerchantRequest,
    CreateOrderRequest,
    CreateOrderResponse,
    MerchantResponse,
    ShipOrderRequest,
    ShipOrderResponse,
    SmsWebhookRequest,
    SmsWebhookResponse,
)

router = APIRouter(tags=["topdmbozor-p2p"])


def _map_order_error(exc: TopdmbozorOrderError) -> HTTPException:
    status = 404 if exc.code == "not_found" else 400 if exc.code != "config_error" else 503
    return HTTPException(status_code=status, detail=str(exc))


def _map_webhook_error(exc: PaymentWebhookError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(exc))


@router.post("/orders/create", response_model=CreateOrderResponse)
async def create_order(
    body: CreateOrderRequest,
    db: AsyncSession = Depends(get_db_session),
) -> CreateOrderResponse:
    """Xaridor buyurtmasi + dinamik Click P2P havolasi."""
    service = TopdmbozorOrderService(db)
    try:
        return await service.create_order(
            phone_number=body.phone_number,
            username=body.username,
            merchant_id=body.merchant_id,
            amount=body.amount,
        )
    except TopdmbozorOrderError as exc:
        raise _map_order_error(exc) from exc


@router.post("/payments/webhook", response_model=SmsWebhookResponse)
async def payments_sms_webhook(
    payload_bytes: bytes = Depends(verify_sms_webhook_signature),
    db: AsyncSession = Depends(get_db_session),
) -> SmsWebhookResponse:
    """SMS-Gate: Click P2P bank SMS → avtomatik paid + frozen_balance (HMAC himoyalangan)."""
    try:
        body = SmsWebhookRequest.model_validate_json(payload_bytes)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc

    service = PaymentWebhookService(db)
    try:
        return await service.process_sms(body.message)
    except PaymentWebhookError as exc:
        raise _map_webhook_error(exc) from exc


@router.post("/orders/{order_id}/ship", response_model=ShipOrderResponse)
async def ship_order(
    order_id: UUID,
    body: ShipOrderRequest,
    db: AsyncSession = Depends(get_db_session),
) -> ShipOrderResponse:
    """BTS tracking raqami → shipped + Celery monitoring."""
    service = TopdmbozorOrderService(db)
    try:
        order = await service.ship_order(order_id, tracking_number=body.tracking_number)
    except TopdmbozorOrderError as exc:
        raise _map_order_error(exc) from exc

    task = poll_single_order_tracking.delay(str(order.id))
    return ShipOrderResponse(
        order_id=order.id,
        status=order.status,
        delivery_status=order.delivery_status,
        tracking_number=order.tracking_number or body.tracking_number,
        celery_task_id=task.id,
    )


@router.post("/merchants", response_model=MerchantResponse)
async def create_merchant(
    body: CreateMerchantRequest,
    db: AsyncSession = Depends(get_db_session),
) -> MerchantResponse:
    """Pilot: do'kon yaratish (keyin admin/self-service)."""
    repo = TopdmbozorRepository(db)
    user_id = None
    if body.phone_number:
        user = await repo.get_or_create_user(phone_number=body.phone_number, username=body.username)
        user_id = user.id
    merchant = await repo.create_merchant(
        shop_name=body.shop_name,
        card_number=body.card_number,
        user_id=user_id,
    )
    await db.commit()
    return MerchantResponse(
        id=merchant.id,
        shop_name=merchant.shop_name,
        card_number=merchant.card_number,
        balance=str(merchant.balance),
        frozen_balance=str(merchant.frozen_balance),
        is_active=merchant.is_active,
    )
