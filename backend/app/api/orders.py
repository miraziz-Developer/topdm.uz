from __future__ import annotations

import logging
import re
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.domain.interfaces.notifier_gateway import NotifierGateway
from app.infrastructure.cache.redis_gateway import RedisCacheGateway
from app.infrastructure.db.session import get_db_session
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway
from app.interfaces.api.serializers import build_store_address_payload, format_store_location
from app.application.marketplace.use_cases import MarketplaceUseCases
from app.schemas.orders import (
    LiveOrdersResponse,
    OrderReserveRequest,
    OrderReserveResponse,
    OrderStatus,
    PaymentMethod,
    ReservationLineSchema,
    StoreAddressSchema,
)
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.services.dispatcher import PickupDispatchPayload, ReservationCrmDispatcher
from app.services.inventory import InventoryError, reserve_pickup_line_locked

logger = logging.getLogger(__name__)

router = APIRouter(tags=["orders"])

PHONE_PATTERN = re.compile(r"^\+998\d{9}$")
PICKUP_TIME_SLOTS = frozenset({"09:00", "12:00", "15:00"})
PICKUP_TIME_LABELS = {
    "09:00": "09:00 - 11:00 (Ertalab)",
    "12:00": "11:00 - 14:00 (Tushlik)",
    "15:00": "14:00 - 17:00 (Abaddan keyin)",
}
PAYMENT_METHOD_LABELS = {
    PaymentMethod.cash: "Naqd pul (do'konda)",
    PaymentMethod.terminal: "Terminal — Uzcard / Humo",
    PaymentMethod.click: "Click — onlayn to'lov",
    PaymentMethod.payme: "Payme — onlayn to'lov",
}

ONLINE_PAYMENT_METHODS = frozenset({PaymentMethod.click, PaymentMethod.payme})


def _customer_online_checkout_url(
    *,
    provider: PaymentMethod,
    checkout_id: str,
    amount_uzs: int,
) -> str | None:
    settings = get_settings()
    if not settings.enable_online_checkout or provider not in ONLINE_PAYMENT_METHODS:
        return None
    # Local/staging should be able to override frontend domain explicitly.
    base = (settings.payment_checkout_base_url or settings.site_url or "https://bozorliii.uz").rstrip("/")
    return (
        f"{base}/checkout/{provider.value}"
        f"?checkout_id={checkout_id}&amount={int(amount_uzs)}"
    )


def _notifier() -> NotifierGateway:
    return TelegramNotifierGateway(get_settings().telegram_bot_token)


async def _enforce_lookup_rate_limit(http_request: Request, phone: str) -> None:
    settings = get_settings()
    limit = max(1, settings.order_lookup_rate_limit_per_minute)
    cache = RedisCacheGateway()
    client_ip = http_request.client.host if http_request.client else "unknown"
    phone_key = phone.replace("+", "")

    if not await cache.check_fixed_window(f"lookup:ip:{client_ip}", limit=limit, window_seconds=60):
        raise HTTPException(status_code=429, detail="Juda ko'p so'rov. Biroz kutib qayta urinib ko'ring.")
    if not await cache.check_fixed_window(f"lookup:phone:{phone_key}", limit=limit, window_seconds=60):
        raise HTTPException(status_code=429, detail="Telefon bo'yicha qidiruv limiti. Biroz kuting.")


def _marketplace_use_case(db: AsyncSession) -> MarketplaceUseCases:
    return MarketplaceUseCases(
        repo=MarketplaceRepository(db),
        notifier=TelegramNotifierGateway(get_settings().telegram_bot_token),
    )


async def _enforce_reserve_rate_limit(http_request: Request, phone: str) -> None:
    settings = get_settings()
    limit = max(1, settings.order_reserve_rate_limit_per_minute)
    cache = RedisCacheGateway()
    client_ip = http_request.client.host if http_request.client else "unknown"
    phone_key = phone.replace("+", "")

    if not await cache.check_fixed_window(f"reserve:ip:{client_ip}", limit=limit, window_seconds=60):
        raise HTTPException(
            status_code=429,
            detail="Juda ko'p so'rov. Bir daqiqadan keyin qayta urinib ko'ring.",
        )
    if not await cache.check_fixed_window(f"reserve:phone:{phone_key}", limit=limit, window_seconds=60):
        raise HTTPException(
            status_code=429,
            detail="Bu telefon uchun bron limiti. Biroz kuting yoki qo'llab-quvvatlashga murojaat qiling.",
        )


def _validate_request(request: OrderReserveRequest) -> tuple[str, str, str]:
    phone = request.user_phone
    if not PHONE_PATTERN.match(phone):
        raise HTTPException(
            status_code=400,
            detail="Telefon raqami +998 (XX) XXX-XX-XX formatida bo'lishi kerak",
        )
    if request.pickup_time not in PICKUP_TIME_SLOTS:
        raise HTTPException(status_code=400, detail="Noto'g'ri olib ketish vaqti tanlandi")
    if request.pickup_date < date.today():
        raise HTTPException(status_code=400, detail="O'tgan sana uchun bron qilib bo'lmaydi")
    if not request.items:
        raise HTTPException(status_code=400, detail="Kamida bitta mahsulot tanlang")

    pickup_label = PICKUP_TIME_LABELS[request.pickup_time]
    payment_label = PAYMENT_METHOD_LABELS[request.payment_method]
    return phone, pickup_label, payment_label


async def execute_pickup_reservation(
    db: AsyncSession,
    notifier: NotifierGateway,
    request: OrderReserveRequest,
    *,
    http_request: Request | None = None,
) -> OrderReserveResponse:
    phone, pickup_label, payment_label = _validate_request(request)
    if http_request is not None:
        await _enforce_reserve_rate_limit(http_request, phone)
    customer_email = request.user_email.strip() if request.user_email and request.user_email.strip() else None

    reservations: list[ReservationLineSchema] = []
    dispatch_payloads: list[PickupDispatchPayload] = []
    primary_shop = None
    total_amount = 0

    try:
        async with db.begin():
            for item in request.items:
                note_parts = [
                    f"Olib ketish: {request.pickup_date.isoformat()} ({pickup_label})",
                    f"To'lov: {payment_label}",
                ]
                if request.note and request.note.strip():
                    note_parts.insert(0, request.note.strip())
                line_note = " | ".join(note_parts)

                line = await reserve_pickup_line_locked(
                    db,
                    product_id=item.product_id,
                    quantity=item.quantity,
                    customer_phone=phone,
                    customer_email=customer_email,
                    pickup_date=request.pickup_date,
                    pickup_time=request.pickup_time,
                    note=line_note,
                    ref_token=request.ref_token,
                    payment_method=request.payment_method.value,
                )

                if primary_shop is None:
                    primary_shop = line.shop

                line_total = int(line.order.total_price)
                total_amount += line_total
                store_loc = format_store_location(line.shop)

                dispatch_payloads.append(
                    PickupDispatchPayload(
                        shop=line.shop,
                        order=line.order,
                        product=line.product,
                        customer_phone=phone,
                        pickup_date=request.pickup_date,
                        pickup_window_label=pickup_label,
                        payment_method_label=payment_label,
                        store_location=store_loc,
                    )
                )

                reservations.append(
                    ReservationLineSchema(
                        order_id=str(line.order.id),
                        product_id=str(item.product_id),
                        shop_id=str(line.product.shop_id),
                        quantity=item.quantity,
                        total_price=float(line_total),
                        status=line.order.status,
                    )
                )
    except InventoryError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except SQLAlchemyError:
        logger.exception("pickup_reservation_db_error")
        raise HTTPException(
            status_code=500,
            detail="Bronni saqlab bo'lmadi. Iltimos, qayta urinib ko'ring.",
        ) from None
    except Exception:
        logger.exception("pickup_reservation_unexpected_error")
        raise HTTPException(
            status_code=500,
            detail="Bronni saqlab bo'lmadi. Iltimos, qayta urinib ko'ring.",
        ) from None

    if primary_shop is None:
        raise HTTPException(status_code=400, detail="Buyurtma yaratib bo'lmadi")

    dispatcher = ReservationCrmDispatcher(db, notifier)
    try:
        await dispatcher.dispatch_after_commit(dispatch_payloads)
    except SQLAlchemyError:
        logger.exception("pickup_reservation_crm_error")
    except Exception:
        logger.exception("pickup_reservation_crm_unexpected")

    address = build_store_address_payload(primary_shop)
    map_params: list[str] = [f"merchant_id={primary_shop.id}", "focus=true", "source=order"]
    block = address.get("block")
    stall = address.get("stall")
    if block:
        map_params.append(f"block={block}")
    if stall:
        map_params.append(f"stall={stall}")
    map_url = f"/map?{'&'.join(map_params)}"

    checkout_id: str | None = None
    online_url: str | None = None
    settings = get_settings()
    if (
        settings.enable_online_checkout
        and request.payment_method in ONLINE_PAYMENT_METHODS
        and reservations
    ):
        from uuid import UUID as _UUID

        from app.application.payments.order_payment_service import OrderPaymentService

        order_uuids = [_UUID(r.order_id) for r in reservations]
        pay_svc = OrderPaymentService(db, settings)
        try:
            checkout = await pay_svc.create_checkout_for_orders(
                order_ids=order_uuids,
                amount_uzs=total_amount,
                provider=request.payment_method.value,
                customer_phone=phone,
            )
            await db.commit()
            checkout_id = str(checkout.id)
            online_url = _customer_online_checkout_url(
                provider=request.payment_method,
                checkout_id=checkout_id,
                amount_uzs=total_amount,
            )
        except ValueError:
            await db.rollback()
            logger.warning("checkout_session_create_failed", exc_info=True)

    return OrderReserveResponse(
        reservations=reservations,
        reservation_count=len(reservations),
        total_price=float(total_amount),
        status=OrderStatus.reserved.value,
        pickup_date=request.pickup_date.isoformat(),
        pickup_time=request.pickup_time,
        pickup_window_label=pickup_label,
        payment_method=request.payment_method,
        payment_method_label=payment_label,
        store_location=address["formatted"],
        store_address=StoreAddressSchema(**address),
        merchant_phone=primary_shop.owner_phone,
        shop_name=primary_shop.name,
        shop_slug=primary_shop.slug,
        map_url=map_url,
        checkout_id=checkout_id,
        online_checkout_url=online_url,
    )


@router.post("/orders/reserve", response_model=OrderReserveResponse)
async def reserve_pickup_order(
    payload: OrderReserveRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db_session),
    notifier: NotifierGateway = Depends(_notifier),
) -> OrderReserveResponse:
    return await execute_pickup_reservation(db, notifier, payload, http_request=http_request)


class OrderLookupRequest(BaseModel):
    user_phone: str = Field(min_length=13, max_length=20)


@router.post("/orders/lookup", response_model=LiveOrdersResponse)
async def lookup_orders_by_phone(
    payload: OrderLookupRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> LiveOrdersResponse:
    """Mehmon buyurtmalar — telefon raqami bo'yicha (login shart emas)."""
    phone = payload.user_phone.strip()
    if not PHONE_PATTERN.match(phone):
        raise HTTPException(
            status_code=400,
            detail="Telefon raqami +998 (XX) XXX-XX-XX formatida bo'lishi kerak",
        )
    await _enforce_lookup_rate_limit(http_request, phone)
    use_case = _marketplace_use_case(db)
    items = await use_case.get_live_orders(phone)
    return LiveOrdersResponse(items=items)
