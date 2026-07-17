from __future__ import annotations

import logging
import re
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.marketplace.use_cases import MarketplaceUseCases
from app.core.config import get_settings
from app.domain.interfaces.notifier_gateway import NotifierGateway
from app.infrastructure.cache.redis_gateway import RedisCacheGateway
from app.infrastructure.db.session import get_db_session
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway
from app.interfaces.api.serializers import build_store_address_payload, format_store_location
from app.core.phone import normalize_uz_phone_e164
from app.infrastructure.auth.user_repo import UserAuthRepository
from app.schemas.orders import (
    LiveOrdersResponse,
    OrderReserveRequest,
    OrderReserveResponse,
    OrderStatus,
    PaymentMethod,
    ReservationLineSchema,
    StoreAddressSchema,
)
from app.infrastructure.auth.deps import AuthUser, get_optional_user
from app.infrastructure.db.models import ProductModel
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.services.dispatcher import PickupDispatchPayload, ReservationCrmDispatcher
from app.application.marketplace.pickup_time_constants import PICKUP_TIME_LABELS, PICKUP_TIME_SLOTS
from app.services.inventory import InventoryError, reserve_pickup_line_locked

logger = logging.getLogger(__name__)

router = APIRouter(tags=["orders"])

PHONE_PATTERN = re.compile(r"^\+998\d{9}$")

PAYMENT_METHOD_LABELS = {
    PaymentMethod.cash: "Naqd pul (do'konda)",
    PaymentMethod.terminal: "Terminal — Uzcard / Humo",
    PaymentMethod.click: "Click — onlayn to'lov",
}

ONLINE_PAYMENT_METHODS = frozenset({PaymentMethod.click})


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


def _normalize_uz_phone(phone: str) -> str:
    normalized = normalize_uz_phone_e164(phone)
    if not normalized:
        return phone.strip()
    return normalized


def _customer_phone_for_reserve(request: OrderReserveRequest, user: AuthUser | None) -> str:
    """Bron telefoni — login bo'lsa profilga moslab, mehmon bo'lsa OTP tasdig'i bilan."""
    phone = _normalize_uz_phone(request.user_phone)
    if not PHONE_PATTERN.match(phone):
        raise HTTPException(
            status_code=400,
            detail="Telefon raqami +998 (XX) XXX-XX-XX formatida bo'lishi kerak",
        )
    if user is not None and user.phone:
        account_phone = _normalize_uz_phone(user.phone)
        if PHONE_PATTERN.match(account_phone) and account_phone != phone:
            raise HTTPException(
                status_code=400,
                detail="Telefon profilingizdagi raqam bilan mos kelishi kerak yoki profilni yangilang",
            )
        if PHONE_PATTERN.match(account_phone):
            return account_phone
    return phone


async def assert_guest_phone_verified(phone: str, verification_token: str | None) -> None:
    """Mehmon (login'siz) buyurtma uchun telefon OTP bilan tasdiqlangan bo'lishi shart."""
    from app.infrastructure.messaging.phone_otp import PhoneOtpError, phone_otp_gateway

    if not verification_token:
        raise HTTPException(
            status_code=401,
            detail="Telefon raqamini tasdiqlang yoki hisobingizga kiring",
        )
    try:
        await phone_otp_gateway.assert_verified(phone, verification_token)
    except PhoneOtpError as exc:
        raise HTTPException(status_code=401, detail=exc.message) from exc


def _validate_request(request: OrderReserveRequest, *, user: AuthUser | None) -> tuple[str, str, str]:
    phone = _customer_phone_for_reserve(request, user)
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
    user: AuthUser | None,
    http_request: Request | None = None,
) -> OrderReserveResponse:
    phone, pickup_label, payment_label = _validate_request(request, user=user)
    # Mehmon (login'siz) bo'lsa telefon OTP bilan tasdiqlangan bo'lishi shart
    if user is None:
        await assert_guest_phone_verified(phone, request.verification_token)
    if http_request is not None:
        await _enforce_reserve_rate_limit(http_request, phone)

    if user is not None:
        auth_repo = UserAuthRepository(db)
        user_row = await auth_repo.get_by_id(user.id)
        if user_row and not user_row.phone and PHONE_PATTERN.match(phone):
            user_row.phone = phone
            await db.flush()

    customer_email = request.user_email.strip() if request.user_email and request.user_email.strip() else None
    if not customer_email and user is not None and user.email:
        customer_email = user.email.strip() or None

    reservations: list[ReservationLineSchema] = []
    dispatch_payloads: list[PickupDispatchPayload] = []
    primary_shop = None
    total_amount = 0

    # BUG FIX: Bir telefon raqami bir mahsulotga bir kunda 3 tadan ko'p aktiv bron qila olmaydi
    from sqlalchemy import func
    from app.infrastructure.db.models import OrderModel as _OrderModel
    active_statuses = ("reserved", "confirmed", "preparing", "ready", "pending")
    for item in request.items:
        existing_count = await db.scalar(
            select(func.count()).select_from(_OrderModel).where(
                _OrderModel.product_id == item.product_id,
                _OrderModel.customer_phone == phone,
                _OrderModel.status.in_(active_statuses),
            )
        )
        if int(existing_count or 0) >= 3:
            raise HTTPException(
                status_code=400,
                detail="Bu mahsulotga allaqachon 3 ta aktiv broningiz bor. Avvalgi bronni bekor qiling.",
            )

    product_ids = [item.product_id for item in request.items]
    shop_rows = await db.execute(
        select(ProductModel.id, ProductModel.shop_id, ProductModel.price).where(ProductModel.id.in_(product_ids))
    )
    product_rows = shop_rows.all()
    shop_map = {row.id: row.shop_id for row in product_rows}
    price_map = {row.id: int(row.price) for row in product_rows}
    if len(shop_map) != len(product_ids):
        raise HTTPException(status_code=400, detail="Ba'zi mahsulotlar topilmadi")
    unique_shops = set(shop_map.values())
    if len(unique_shops) > 1:
        raise HTTPException(
            status_code=400,
            detail="Bir bron uchun faqat bitta do'kondan mahsulot tanlang",
        )

    cart_total = sum(price_map[item.product_id] * item.quantity for item in request.items)
    coins_used = 0
    discount_uzs = 0
    if user is not None and int(request.coins_to_redeem or 0) > 0:
        from app.application.loyalty.customer_coin_service import (
            CustomerCoinService,
            InsufficientCustomerCoinsError,
        )

        try:
            coins_used, discount_uzs = await CustomerCoinService(db).redeem_for_order(
                user.id,
                order_total_uzs=cart_total,
                coins_requested=int(request.coins_to_redeem),
            )
        except InsufficientCustomerCoinsError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    discount_applied = False
    try:
        for item in request.items:
            note_parts = [
                f"Olib ketish: {request.pickup_date.isoformat()} ({pickup_label})",
                f"To'lov: {payment_label}",
            ]
            if request.note and request.note.strip():
                note_parts.insert(0, request.note.strip())
            line_note = " | ".join(note_parts)

            variant_bits: list[str] = []
            if item.color and item.color.strip():
                variant_bits.append(f"Rang: {item.color.strip()}")
            if item.size and item.size.strip():
                variant_bits.append(f"Razmer: {item.size.strip()}")
            if variant_bits:
                line_note = f"{' | '.join(variant_bits)} | {line_note}"

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
                variant_color=item.color.strip() if item.color else None,
                variant_size=item.size.strip() if item.size else None,
                customer_user_id=user.id if user is not None else None,
            )

            if discount_uzs > 0 and not discount_applied:
                line.order.total_price = max(0, int(line.order.total_price) - discount_uzs)
                line.order.loyalty_coins_redeemed = coins_used
                discount_applied = True
                if coins_used > 0:
                    line_note = f"{line_note} | Coin: -{discount_uzs:,} so'm ({coins_used} coin)".replace(",", " ")
                    line.order.note = line_note

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
            checkout = await pay_svc.create_checkout_for_orders(
                order_ids=order_uuids,
                amount_uzs=total_amount,
                provider=request.payment_method.value,
                customer_phone=phone,
            )
            checkout_id = str(checkout.id)
            online_url = _customer_online_checkout_url(
                provider=request.payment_method,
                checkout_id=checkout_id,
                amount_uzs=total_amount,
            )

        await db.commit()
    except InventoryError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        await db.rollback()
        if str(exc) == "online_checkout_failed":
            raise HTTPException(
                status_code=503,
                detail="Onlayn to'lov sessiyasi yaratilmadi. Qayta urinib ko'ring yoki naqd tanlang.",
            ) from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        await db.rollback()
        raise
    except SQLAlchemyError:
        await db.rollback()
        logger.exception("pickup_reservation_db_error")
        raise HTTPException(
            status_code=500,
            detail="Bronni saqlab bo'lmadi. Iltimos, qayta urinib ko'ring.",
        ) from None
    except Exception:
        await db.rollback()
        logger.exception("pickup_reservation_unexpected_error")
        raise HTTPException(
            status_code=500,
            detail="Bronni saqlab bo'lmadi. Iltimos, qayta urinib ko'ring.",
        ) from None

    if primary_shop is None:
        raise HTTPException(status_code=400, detail="Buyurtma yaratib bo'lmadi")

    dispatcher = ReservationCrmDispatcher(db, notifier)
    click_pending = (
        request.payment_method in ONLINE_PAYMENT_METHODS
        and checkout_id is not None
    )
    try:
        await dispatcher.dispatch_after_commit(dispatch_payloads, payment_pending=click_pending)
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
    user: AuthUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db_session),
    notifier: NotifierGateway = Depends(_notifier),
) -> OrderReserveResponse:
    return await execute_pickup_reservation(
        db,
        notifier,
        payload,
        user=user,
        http_request=http_request,
    )


class OrderLookupSendOtpRequest(BaseModel):
    user_phone: str = Field(min_length=13, max_length=20)


class OrderLookupRequest(BaseModel):
    user_phone: str = Field(min_length=13, max_length=20)
    otp: str | None = Field(default=None, min_length=4, max_length=8)
    verification_token: str | None = Field(default=None, min_length=8, max_length=64)


@router.post("/orders/lookup/send-otp")
async def lookup_orders_send_otp(
    payload: OrderLookupSendOtpRequest,
    http_request: Request,
) -> dict:
    """Mehmon buyurtma qidiruv — SMS tasdiqlash kodi."""
    from app.infrastructure.messaging.phone_otp import PhoneOtpError, phone_otp_gateway

    phone = payload.user_phone.strip()
    if not PHONE_PATTERN.match(phone):
        raise HTTPException(
            status_code=400,
            detail="Telefon raqami +998 (XX) XXX-XX-XX formatida bo'lishi kerak",
        )
    await _enforce_lookup_rate_limit(http_request, phone)
    try:
        return await phone_otp_gateway.issue_otp(phone)
    except PhoneOtpError as exc:
        status = 503 if exc.code in {"sms_not_configured", "sms_send_failed", "eskiz_auth_failed"} else 400
        raise HTTPException(status_code=status, detail=exc.message) from exc


@router.post("/orders/lookup/verify-otp")
async def lookup_orders_verify_otp(
    payload: OrderLookupRequest,
    http_request: Request,
) -> dict:
    """OTP tasdiqlash — keyingi lookup uchun verification_token qaytaradi."""
    from app.infrastructure.messaging.phone_otp import PhoneOtpError, phone_otp_gateway

    phone = payload.user_phone.strip()
    if not PHONE_PATTERN.match(phone):
        raise HTTPException(status_code=400, detail="Telefon raqami noto'g'ri")
    if not payload.otp:
        raise HTTPException(status_code=400, detail="OTP talab qilinadi")
    await _enforce_lookup_rate_limit(http_request, phone)
    try:
        token = await phone_otp_gateway.verify_otp(phone, payload.otp)
        return {"status": "ok", "phone": phone, "verification_token": token}
    except PhoneOtpError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc


@router.post("/orders/lookup", response_model=LiveOrdersResponse)
async def lookup_orders_by_phone(
    payload: OrderLookupRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: AuthUser | None = Depends(get_optional_user),
) -> LiveOrdersResponse:
    """Mehmon buyurtmalar — telefon + OTP tasdiqlash (PII himoya)."""
    from app.infrastructure.messaging.phone_otp import PhoneOtpError, phone_otp_gateway

    phone = payload.user_phone.strip()
    if not PHONE_PATTERN.match(phone):
        raise HTTPException(
            status_code=400,
            detail="Telefon raqami +998 (XX) XXX-XX-XX formatida bo'lishi kerak",
        )
    await _enforce_lookup_rate_limit(http_request, phone)

    profile_phone = (user.phone or "").strip() if user is not None else ""
    skip_otp = bool(profile_phone and profile_phone == phone)
    if not skip_otp:
        try:
            await phone_otp_gateway.assert_verified(phone, payload.verification_token)
        except PhoneOtpError as exc:
            raise HTTPException(status_code=401, detail=exc.message) from exc

    use_case = _marketplace_use_case(db)
    items = await use_case.get_live_orders(customer_phone=phone, scope="all")
    return LiveOrdersResponse(items=items)
