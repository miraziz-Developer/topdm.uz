"""Olib ketish sanasidan 4 kun o'tgach kelilmagan pickup buyurtmalarni bekor qilish."""
from __future__ import annotations

from datetime import date, timedelta

from loguru import logger
from sqlalchemy import select

from app.application.marketplace.customer_order_notifications import CustomerOrderNotificationService
from app.application.merchant.merchant_order_notify import notify_merchant_order_cancelled
from app.core.config import get_settings
from app.infrastructure.db.models import OrderModel, ProductModel, ShopModel
from app.infrastructure.db.session import AsyncSessionFactory
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway
from app.infrastructure.tasks.async_runner import run_async_task
from app.infrastructure.tasks.celery_app import celery_app
from app.services.inventory import ACTIVE_RESERVED_STATUSES, release_order_reserved_stock

PICKUP_NO_SHOW_GRACE_DAYS = 4


@celery_app.task(name="orders.expire_pickup_no_shows", bind=True, max_retries=2)
def expire_pickup_no_shows(self) -> dict:
    try:
        return run_async_task(_expire_async())
    except Exception as exc:
        logger.exception("expire_pickup_no_shows_failed")
        raise self.retry(exc=exc, countdown=300) from exc


async def _expire_async() -> dict:
    cutoff_date = date.today() - timedelta(days=PICKUP_NO_SHOW_GRACE_DAYS)
    summary = {"cancelled": 0, "stock_released": 0}
    settings = get_settings()
    notifier = TelegramNotifierGateway(settings.telegram_bot_token) if settings.telegram_bot_token else None
    customer_notify = CustomerOrderNotificationService()

    async with AsyncSessionFactory() as session:
        result = await session.execute(
            select(OrderModel)
            .where(
                OrderModel.fulfillment_type == "pickup",
                OrderModel.pickup_date.isnot(None),
                OrderModel.pickup_date <= cutoff_date,
                OrderModel.status.in_(tuple(ACTIVE_RESERVED_STATUSES)),
            )
            .with_for_update()
        )
        orders = list(result.scalars().all())

        for order in orders:
            prev_status = order.status
            product_name = "Mahsulot"
            if order.product_id:
                product = await session.get(ProductModel, order.product_id)
                if product and product.name:
                    product_name = product.name

            try:
                if await release_order_reserved_stock(session, order_id=order.id):
                    summary["stock_released"] += 1
            except Exception:
                logger.exception("pickup_no_show_stock_release_failed order_id={}", order.id)

            reason = (
                f"Olib ketish sanasi ({order.pickup_date}) dan {PICKUP_NO_SHOW_GRACE_DAYS} kun o'tdi — "
                "mijoz kelmadi yoki muddat uzaytirilmadi"
            )
            order.status = "cancelled"
            order.note = f"{(order.note or '').strip()} | {reason}".strip(" |")
            summary["cancelled"] += 1

            shop = await session.get(ShopModel, order.shop_id)
            if shop and notifier:
                try:
                    await notify_merchant_order_cancelled(
                        notifier,
                        shop=shop,
                        order=order,
                        product_name=product_name,
                        reason=reason,
                    )
                except Exception:
                    logger.exception("pickup_no_show_merchant_notify_failed order_id={}", order.id)

            try:
                await customer_notify.push_order_status_change(
                    order_id=order.id,
                    user_id=getattr(order, "customer_user_id", None),
                    phone=order.customer_phone,
                    product_name=product_name,
                    new_status="cancelled",
                    prev_status=prev_status,
                )
            except Exception:
                logger.exception("pickup_no_show_customer_notify_failed order_id={}", order.id)

        await session.commit()

    logger.info("expire_pickup_no_shows_done {}", summary)
    return summary
