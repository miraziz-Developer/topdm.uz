"""In-app (Redis) + tashqi (Telegram/email) mijoz bildirishnomalarini bir joydan chaqirish."""
from __future__ import annotations

from uuid import UUID

from loguru import logger

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.marketplace.customer_order_notifications import CustomerOrderNotificationService
from app.application.marketplace.customer_outbound_notify import CustomerOutboundNotifyService
from app.infrastructure.db.models import OrderModel


async def dispatch_customer_order_status_notify(
    session: AsyncSession,
    *,
    order: OrderModel,
    product_name: str,
    new_status: str,
    prev_status: str | None,
) -> None:
    await CustomerOrderNotificationService().push_order_status_change(
        order_id=order.id,
        user_id=getattr(order, "customer_user_id", None),
        phone=order.customer_phone,
        product_name=product_name,
        new_status=new_status,
        prev_status=prev_status,
    )
    try:
        await CustomerOutboundNotifyService(session).notify_order_status(
            order=order,
            product_name=product_name,
            new_status=new_status,
            prev_status=prev_status,
        )
    except Exception:
        logger.exception("customer_outbound_notify_failed", extra={"order_id": str(order.id)})
