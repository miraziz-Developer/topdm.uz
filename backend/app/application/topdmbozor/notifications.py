"""Do'kon egasiga xabar — hozircha mock (keyin Telegram/SMS)."""

from __future__ import annotations

from uuid import UUID

from loguru import logger


async def notify_merchant_order_paid(*, merchant_id: UUID, order_id: UUID, amount_uzs: int) -> None:
    logger.info(
        "tdb_merchant_notify_mock order_paid merchant_id={} order_id={} amount={}",
        merchant_id,
        order_id,
        amount_uzs,
    )


async def notify_merchant_order_completed(*, merchant_id: UUID, order_id: UUID, merchant_share: int) -> None:
    logger.info(
        "tdb_merchant_notify_mock order_completed merchant_id={} order_id={} share={}",
        merchant_id,
        order_id,
        merchant_share,
    )
