"""Mijoz buyurtmasini bekor qilish, olib ketish vaqtini o'zgartirish, to'lov holati."""
from __future__ import annotations

from datetime import date
from uuid import UUID

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.merchant.merchant_order_notify import (
    notify_merchant_order_cancelled,
    notify_merchant_order_rescheduled,
    notify_merchant_payment_method_changed,
)
from app.application.payments.order_payment_service import OrderPaymentService
from app.core.config import Settings, get_settings
from app.domain.interfaces.notifier_gateway import NotifierGateway
from app.infrastructure.db.models import OrderModel, ProductModel, ShopModel
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.infrastructure.repositories.order_payment_repo import OrderPaymentRepository
from app.services.inventory import ACTIVE_RESERVED_STATUSES, release_order_reserved_stock

# BUG FIX: Markazlashtirilgan konstantadan import qilinadi
from app.application.marketplace.pickup_time_constants import PICKUP_TIME_LABELS, PICKUP_TIME_SLOTS
CUSTOMER_CANCELLABLE = frozenset({"reserved", "confirmed", "pending"})
CUSTOMER_RESCHEDULABLE = frozenset({"reserved", "confirmed", "pending"})
ONLINE_METHODS = frozenset({"click"})
IN_STORE_METHODS = frozenset({"cash", "terminal"})
PAYMENT_METHOD_LABELS = {
    "cash": "Naqd pul (do'konda)",
    "terminal": "Terminal — Uzcard / Humo",
    "click": "Click — onlayn to'lov",
}


class CustomerOrderError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class CustomerOrderService:
    def __init__(
        self,
        session: AsyncSession,
        *,
        notifier: NotifierGateway | None = None,
        settings: Settings | None = None,
    ) -> None:
        self._session = session
        self._repo = MarketplaceRepository(session)
        self._checkout_repo = OrderPaymentRepository(session)
        self._notifier = notifier
        self._settings = settings or get_settings()

    async def _load_order_for_customer(
        self,
        order_id: UUID,
        *,
        user_id: UUID | None,
        phone: str | None,
        email: str | None,
    ) -> OrderModel:
        order = await self._repo.get_order_for_account(
            order_id,
            user_id=user_id,
            phone=phone,
            email=email,
        )
        if not order:
            raise CustomerOrderError("order_not_found", "Buyurtma topilmadi")
        return order

    async def _latest_checkout(self, order_id: UUID):
        return await self._checkout_repo.find_latest_for_order(order_id)

    async def payment_context(self, order: OrderModel) -> dict:
        method = (order.payment_method or "cash").lower()
        if method not in ONLINE_METHODS:
            return {
                "payment_method": method,
                "payment_status": "at_store",
                "checkout_id": None,
                "online_checkout_url": None,
            }

        checkout = await self._latest_checkout(order.id)
        if checkout and checkout.status == "success":
            return {
                "payment_method": method,
                "payment_status": "paid",
                "checkout_id": str(checkout.id),
                "online_checkout_url": None,
            }
        if checkout and checkout.status == "pending" and (order.status or "").lower() != "cancelled":
            url = OrderPaymentService.checkout_url(
                checkout_id=checkout.id,
                amount_uzs=int(checkout.amount_uzs),
                settings=self._settings,
            )
            return {
                "payment_method": method,
                "payment_status": "unpaid",
                "checkout_id": str(checkout.id),
                "online_checkout_url": url,
            }
        return {
            "payment_method": method,
            "payment_status": "failed" if checkout and checkout.status == "failed" else "unpaid",
            "checkout_id": str(checkout.id) if checkout else None,
            "online_checkout_url": None,
        }

    async def enrich_order_dict(self, order_dict: dict) -> dict:
        order_id = UUID(str(order_dict["id"]))
        order = await self._repo.get_order_by_id(order_id)
        if not order:
            return order_dict
        pay = await self.payment_context(order)
        status = (order.status or "reserved").lower()
        unpaid_click_pickup = (
            (order.fulfillment_type or "pickup") == "pickup"
            and pay.get("payment_method") == "click"
            and pay.get("payment_status") == "unpaid"
        )
        return {
            **order_dict,
            **pay,
            "payment_method_label": PAYMENT_METHOD_LABELS.get(pay.get("payment_method") or "cash", ""),
            "can_cancel": status in CUSTOMER_CANCELLABLE and status != "cancelled",
            "can_reschedule": (
                status in CUSTOMER_RESCHEDULABLE
                and (order.fulfillment_type or "pickup") == "pickup"
                and bool(order.pickup_date)
            ),
            "can_change_payment_method": unpaid_click_pickup and status in CUSTOMER_RESCHEDULABLE,
        }

    async def cancel_order(
        self,
        order_id: UUID,
        *,
        user_id: UUID | None,
        phone: str | None,
        email: str | None,
        reason: str | None = None,
    ) -> dict:
        order = await self._load_order_for_customer(order_id, user_id=user_id, phone=phone, email=email)
        status = (order.status or "").lower()
        if status == "cancelled":
            return {"order_id": str(order.id), "status": "cancelled"}
        if status not in CUSTOMER_CANCELLABLE:
            raise CustomerOrderError(
                "cannot_cancel",
                "Bu bosqichda buyurtmani bekor qilib bo'lmaydi. Do'kon bilan bog'laning.",
            )

        stmt = select(OrderModel).where(OrderModel.id == order.id).with_for_update()
        locked = (await self._session.execute(stmt)).scalar_one_or_none()
        if not locked:
            raise CustomerOrderError("order_not_found", "Buyurtma topilmadi")

        if locked.status in ACTIVE_RESERVED_STATUSES:
            try:
                await release_order_reserved_stock(self._session, order_id=locked.id)
            except Exception:
                logger.exception("customer_cancel_stock_release_failed order_id={}", locked.id)

        pay = await self.payment_context(locked)
        if pay.get("payment_status") == "paid":
            try:
                from app.application.payments.order_refund_service import OrderRefundService

                refund = await OrderRefundService(self._session).refund_cancelled_order(locked)
                if refund.get("status") == "error":
                    logger.error(
                        "customer_cancel_refund_failed order_id={} detail={}",
                        locked.id,
                        refund,
                    )
            except Exception:
                logger.exception("customer_cancel_refund_exception order_id={}", locked.id)

        note_suffix = (reason or "Mijoz tomonidan bekor qilindi").strip()
        locked.status = "cancelled"
        locked.note = f"{(locked.note or '').strip()} | {note_suffix}".strip(" |")
        try:
            from app.application.loyalty.customer_coin_service import CustomerCoinService

            await CustomerCoinService(self._session).refund_redeemed(locked)
        except Exception:
            logger.exception("customer_coin_refund_failed order_id={}", locked.id)
        await self._session.flush()

        checkout = await self._latest_checkout(locked.id)
        if checkout and checkout.status == "pending":
            await self._checkout_repo.mark_failed(checkout)

        product = await self._session.get(ProductModel, locked.product_id)
        shop = await self._session.get(ShopModel, locked.shop_id)
        product_name = product.name if product else "Mahsulot"
        if shop and product:
            await notify_merchant_order_cancelled(
                self._notifier,
                shop=shop,
                order=locked,
                product_name=product_name,
                reason=note_suffix,
            )

        try:
            from app.application.marketplace.customer_order_notify_dispatch import (
                dispatch_customer_order_status_notify,
            )

            await dispatch_customer_order_status_notify(
                self._session,
                order=locked,
                product_name=product_name,
                new_status="cancelled",
                prev_status=status,
            )
        except Exception:
            logger.exception("customer_cancel_notify_failed order_id={}", locked.id)

        await self._session.commit()
        return {"order_id": str(locked.id), "status": locked.status}

    async def reschedule_pickup(
        self,
        order_id: UUID,
        *,
        pickup_date: date,
        pickup_time: str,
        user_id: UUID | None,
        phone: str | None,
        email: str | None,
    ) -> dict:
        if pickup_time not in PICKUP_TIME_SLOTS:
            raise CustomerOrderError("invalid_time", "Noto'g'ri olib ketish vaqti")
        if pickup_date < date.today():
            raise CustomerOrderError("invalid_date", "O'tgan sana tanlab bo'lmaydi")

        order = await self._load_order_for_customer(order_id, user_id=user_id, phone=phone, email=email)
        status = (order.status or "").lower()
        if (order.fulfillment_type or "pickup") != "pickup":
            raise CustomerOrderError("not_pickup", "Faqat olib ketish buyurtmasi uchun")
        if status not in CUSTOMER_RESCHEDULABLE:
            raise CustomerOrderError(
                "cannot_reschedule",
                "Buyurtma allaqachon tayyorlanmoqda — vaqtni o'zgartirish uchun do'kon bilan bog'laning.",
            )

        old_date = order.pickup_date.isoformat() if order.pickup_date else "—"
        old_time = PICKUP_TIME_LABELS.get(order.pickup_time or "", order.pickup_time or "—")
        new_label = PICKUP_TIME_LABELS[pickup_time]

        stmt = select(OrderModel).where(OrderModel.id == order.id).with_for_update()
        locked = (await self._session.execute(stmt)).scalar_one_or_none()
        if not locked:
            raise CustomerOrderError("order_not_found", "Buyurtma topilmadi")

        locked.pickup_date = pickup_date
        locked.pickup_time = pickup_time
        locked.note = (
            f"{(locked.note or '').strip()} | "
            f"Vaqt o'zgartirildi: {old_date} ({old_time}) → {pickup_date.isoformat()} ({new_label})"
        ).strip(" |")
        await self._session.flush()

        product = await self._session.get(ProductModel, locked.product_id)
        shop = await self._session.get(ShopModel, locked.shop_id)
        if shop and product:
            await notify_merchant_order_rescheduled(
                self._notifier,
                shop=shop,
                order=locked,
                product_name=product.name,
                old_schedule=f"{old_date} · {old_time}",
                new_schedule=f"{pickup_date.isoformat()} · {new_label}",
            )

        await self._session.commit()
        enriched = await self.enrich_order_dict(
            {
                "id": str(locked.id),
                "status": locked.status,
                "pickup_date": locked.pickup_date.isoformat() if locked.pickup_date else None,
                "pickup_time": locked.pickup_time,
                "pickup_window_label": new_label,
            }
        )
        return enriched

    async def retry_payment_link(
        self,
        order_id: UUID,
        *,
        user_id: UUID | None,
        phone: str | None,
        email: str | None,
    ) -> dict:
        order = await self._load_order_for_customer(order_id, user_id=user_id, phone=phone, email=email)
        if (order.payment_method or "").lower() not in ONLINE_METHODS:
            raise CustomerOrderError("not_online", "Bu buyurtma onlayn to'lov uchun emas")
        if (order.status or "").lower() == "cancelled":
            raise CustomerOrderError("order_cancelled", "Buyurtma bekor qilingan")
        if (order.status or "").lower() in {"completed", "ready", "preparing"}:
            raise CustomerOrderError("already_paid", "To'lov allaqachon amalga oshirilgan yoki buyurtma yopilgan")

        checkout = await self._latest_checkout(order.id)
        if checkout and checkout.status == "success":
            raise CustomerOrderError("already_paid", "To'lov allaqachon amalga oshirilgan")

        if not checkout or checkout.status == "failed":
            pay_svc = OrderPaymentService(self._session, self._settings)
            checkout = await pay_svc.create_checkout_for_orders(
                order_ids=[order.id],
                amount_uzs=int(order.total_price),
                provider=str(order.payment_method),
                customer_phone=order.customer_phone,
            )
            await self._session.commit()

        url = OrderPaymentService.checkout_url(
            checkout_id=checkout.id,
            amount_uzs=int(checkout.amount_uzs),
            settings=self._settings,
        )
        return {
            "checkout_id": str(checkout.id),
            "online_checkout_url": url,
            "amount_uzs": int(checkout.amount_uzs),
        }

    async def change_payment_method(
        self,
        order_id: UUID,
        *,
        new_method: str,
        user_id: UUID | None,
        phone: str | None,
        email: str | None,
    ) -> dict:
        """To'lanmagan Click bronini do'konda naqd/terminalga o'tkazish (faqat olib ketish)."""
        method = new_method.strip().lower()
        if method not in IN_STORE_METHODS:
            raise CustomerOrderError(
                "invalid_payment_method",
                "Faqat naqd yoki terminal tanlash mumkin",
            )

        order = await self._load_order_for_customer(order_id, user_id=user_id, phone=phone, email=email)
        if (order.fulfillment_type or "pickup") != "pickup":
            raise CustomerOrderError(
                "not_pickup",
                "To'lov turini faqat do'kondan olib ketadigan buyurtmalar uchun o'zgartirish mumkin",
            )

        status = (order.status or "").lower()
        if status not in CUSTOMER_RESCHEDULABLE:
            raise CustomerOrderError(
                "cannot_change_payment",
                "Bu bosqichda to'lov turini o'zgartirish mumkin emas",
            )

        pay = await self.payment_context(order)
        if pay.get("payment_method") != "click" or pay.get("payment_status") != "unpaid":
            raise CustomerOrderError(
                "payment_not_pending",
                "To'lov turi faqat onlayn to'lov yakunlanmagan buyurtmalar uchun o'zgartiriladi",
            )

        old_label = PAYMENT_METHOD_LABELS.get("click", "Click")
        new_label = PAYMENT_METHOD_LABELS[method]

        stmt = select(OrderModel).where(OrderModel.id == order.id).with_for_update()
        locked = (await self._session.execute(stmt)).scalar_one_or_none()
        if not locked:
            raise CustomerOrderError("order_not_found", "Buyurtma topilmadi")

        checkout = await self._latest_checkout(locked.id)
        if checkout and checkout.status == "pending":
            await self._checkout_repo.mark_failed(checkout)

        locked.payment_method = method
        locked.note = (
            f"{(locked.note or '').strip()} | "
            f"To'lov turi: {old_label} → {new_label} (do'konda to'laydi)"
        ).strip(" |")
        await self._session.flush()

        product = await self._session.get(ProductModel, locked.product_id)
        shop = await self._session.get(ShopModel, locked.shop_id)
        if shop and product:
            pickup_label = ""
            if locked.pickup_date:
                pickup_label = f"Olib ketish · {locked.pickup_date.isoformat()}"
                if locked.pickup_time:
                    pickup_label += f" {PICKUP_TIME_LABELS.get(locked.pickup_time, locked.pickup_time)}"
            await notify_merchant_payment_method_changed(
                self._notifier,
                shop=shop,
                order=locked,
                product_name=product.name,
                old_method_label=old_label,
                new_method_label=new_label,
                fulfillment_label=pickup_label or "Olib ketish",
            )

        await self._session.commit()
        base = {
            "id": str(locked.id),
            "status": locked.status,
            "payment_method": method,
            "pickup_date": locked.pickup_date.isoformat() if locked.pickup_date else None,
            "pickup_time": locked.pickup_time,
            "pickup_window_label": PICKUP_TIME_LABELS.get(locked.pickup_time or "", ""),
        }
        return await self.enrich_order_dict(base)
