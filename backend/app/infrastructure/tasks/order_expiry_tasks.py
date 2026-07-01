"""To'lanmagan onlayn bronlarni avtomatik bekor qilish."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from loguru import logger
from sqlalchemy import select

from app.infrastructure.db.models import OrderModel
from app.infrastructure.db.session import AsyncSessionFactory
from app.infrastructure.tasks.async_runner import run_async_task
from app.infrastructure.tasks.celery_app import celery_app
from app.services.inventory import ACTIVE_RESERVED_STATUSES, release_order_reserved_stock

ONLINE_PAYMENT_METHODS = frozenset({"click"})
RESERVATION_TTL_MINUTES = 45


@celery_app.task(name="orders.expire_unpaid_reservations", bind=True, max_retries=2)
def expire_unpaid_reservations(self) -> dict:
    try:
        return run_async_task(_expire_async())
    except Exception as exc:
        logger.exception("expire_unpaid_reservations_failed")
        raise self.retry(exc=exc, countdown=120) from exc


async def _expire_async() -> dict:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=RESERVATION_TTL_MINUTES)
    summary = {"cancelled": 0, "stock_released": 0}

    async with AsyncSessionFactory() as session:
        result = await session.execute(
            select(OrderModel)
            .where(
                OrderModel.status == "reserved",
                OrderModel.payment_method.in_(tuple(ONLINE_PAYMENT_METHODS)),
                OrderModel.created_at < cutoff,
            )
            .with_for_update()
        )
        orders = list(result.scalars().all())
        for order in orders:
            # Avval stokni qaytarish — status hali aktiv bo'lishi shart,
            # aks holda release_order_reserved_stock hech narsa qaytarmaydi.
            try:
                if await release_order_reserved_stock(session, order_id=order.id):
                    summary["stock_released"] += 1
            except Exception:
                logger.exception("expire_stock_release_failed order_id={}", order.id)
            order.status = "cancelled"
            order.note = f"{(order.note or '').strip()} | Avtomatik bekor: to'lov kutilmadi".strip(" |")
            summary["cancelled"] += 1
        await session.commit()

    logger.info("expire_unpaid_reservations_done {}", summary)
    return summary
