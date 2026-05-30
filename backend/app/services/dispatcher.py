from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.interfaces.notifier_gateway import NotifierGateway
from app.infrastructure.db.models import OrderModel, ProductModel, ShopModel
from app.models.merchant_notification import MerchantCrmNotificationModel

logger = logging.getLogger(__name__)


@dataclass(slots=True, frozen=True)
class PickupDispatchPayload:
    shop: ShopModel
    order: OrderModel
    product: ProductModel
    customer_phone: str
    pickup_date: date
    pickup_window_label: str
    payment_method_label: str
    store_location: str


class ReservationCrmDispatcher:
    """
    Post-commit CRM pipeline: merchant_crm_notifications row + Telegram broker.
    Must only be invoked after the inventory transaction commits successfully.
    """

    def __init__(self, db: AsyncSession, notifier: NotifierGateway) -> None:
        self._db = db
        self._notifier = notifier

    def _build_message(self, payload: PickupDispatchPayload) -> str:
        return (
            f"Yangi bron: {payload.product.name} ×{payload.order.quantity} — "
            f"{payload.pickup_date.isoformat()} ({payload.pickup_window_label})\n"
            f"Mijoz: {payload.customer_phone}\n"
            f"To'lov: {payload.payment_method_label}\n"
            f"Manzil: {payload.store_location}\n"
            f"Buyurtma: #{str(payload.order.id)[:8]}"
        )

    async def record_crm_notification(self, payload: PickupDispatchPayload) -> None:
        message = self._build_message(payload)
        self._db.add(
            MerchantCrmNotificationModel(
                shop_id=payload.shop.id,
                banner_id=None,
                kind="pickup_reservation",
                message=message,
            )
        )
        logger.info(
            "reservation_crm_notification_queued",
            extra={
                "shop_id": str(payload.shop.id),
                "order_id": str(payload.order.id),
                "kind": "pickup_reservation",
            },
        )

    async def send_telegram_broker(self, payload: PickupDispatchPayload) -> bool:
        chat_id = payload.shop.telegram_chat_id
        if not chat_id:
            logger.info(
                "reservation_telegram_skipped",
                extra={"shop_id": str(payload.shop.id), "reason": "no_telegram_chat_id"},
            )
            return False

        message = (
            f"✅ Bron tasdiqlandi\n"
            f"{payload.product.name} ×{payload.order.quantity}\n"
            f"📅 {payload.pickup_date.isoformat()} · {payload.pickup_window_label}\n"
            f"📞 {payload.customer_phone}\n"
            f"📍 {payload.store_location}"
        )
        try:
            sent = await self._notifier.send_message(int(chat_id), message)
            logger.info(
                "reservation_telegram_dispatched",
                extra={
                    "shop_id": str(payload.shop.id),
                    "order_id": str(payload.order.id),
                    "telegram_sent": bool(sent),
                },
            )
            return bool(sent)
        except Exception:
            logger.warning(
                "reservation_telegram_failed",
                extra={"shop_id": str(payload.shop.id), "order_id": str(payload.order.id)},
            )
            return False

    async def dispatch_after_commit(self, payloads: list[PickupDispatchPayload]) -> None:
        """Persist CRM rows then fire Telegram — separate commit from inventory."""
        if not payloads:
            return

        for payload in payloads:
            await self.record_crm_notification(payload)

        await self._db.commit()

        for payload in payloads:
            await self.send_telegram_broker(payload)
