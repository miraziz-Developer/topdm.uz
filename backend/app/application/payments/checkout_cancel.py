"""To'lov bekor qilinganda bronlangan buyurtmalarni va omborni bo'shatish."""
from __future__ import annotations

from uuid import UUID

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import OrderModel
from app.models.order_checkout_payment import OrderCheckoutPaymentModel
from app.services.inventory import ACTIVE_RESERVED_STATUSES, release_order_reserved_stock


async def cancel_checkout_reserved_orders(
    session: AsyncSession,
    checkout: OrderCheckoutPaymentModel,
    *,
    reason: str,
) -> int:
    """Pending checkout bekor bo'lganda bog'langan buyurtmalarni bekor qiladi."""
    if checkout.status == "success":
        return 0

    order_ids = [UUID(str(x)) for x in (checkout.order_ids or []) if x]
    if not order_ids:
        return 0

    released = 0
    for oid in order_ids:
        row = await session.execute(
            select(OrderModel).where(OrderModel.id == oid).with_for_update()
        )
        order = row.scalar_one_or_none()
        if not order:
            continue
        prev = (order.status or "").lower()
        if prev not in ACTIVE_RESERVED_STATUSES:
            continue
        # Stok avval qaytariladi — status aktivligida, aks holda release ishlamaydi.
        try:
            if await release_order_reserved_stock(session, order_id=order.id):
                released += 1
        except Exception:
            logger.exception("checkout_cancel_stock_release_failed order_id={}", order.id)
        order.status = "cancelled"
        suffix = reason.strip()
        order.note = f"{(order.note or '').strip()} | {suffix}".strip(" |")

    return released
