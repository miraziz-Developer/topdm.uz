from __future__ import annotations

import asyncio

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.infrastructure.cache.premium_carousel_cache import PremiumCarouselCache
from app.infrastructure.db.session import AsyncSessionFactory
from app.infrastructure.messaging.telegram_notifier import TelegramNotifier
from app.infrastructure.repositories.premium_banner_repo import PremiumBannerRepository
from app.models.merchant_notification import MerchantCrmNotificationModel

_EXPIRATION_INTERVAL_SEC = 45


async def _notify_merchants(session: AsyncSession, expired: list[dict]) -> None:
    if not expired:
        return
    settings = get_settings()
    notifier = TelegramNotifier(settings.telegram_bot_token)
    for row in expired:
        msg = (
            f"⏱ Premium banner muddati tugadi\n"
            f"Do'kon: {row.get('shop_name', '')}\n"
            f"Banner: {row.get('title') or 'Reklama'}\n"
            f"Yangilash: {settings.merchant_crm_webapp_url.rstrip('/')}/dashboard/banners"
        )
        session.add(
            MerchantCrmNotificationModel(
                shop_id=row["shop_id"],
                banner_id=row["banner_id"],
                kind="banner_expired",
                message=msg,
            )
        )
        chat_id = row.get("telegram_chat_id")
        if chat_id:
            await notifier.send_message(int(chat_id), msg)


async def run_banner_expiration_once(session: AsyncSession) -> int:
    repo = PremiumBannerRepository(session)
    expired = await repo.expire_due_banners()
    if not expired:
        return 0
    await _notify_merchants(session, expired)
    await session.commit()
    version = await PremiumCarouselCache().bump_invalidation()
    logger.info("premium_banners_expired", count=len(expired), carousel_version=version)
    return len(expired)


async def expire_sponsored_banners() -> int:
    async with AsyncSessionFactory() as session:
        try:
            return await run_banner_expiration_once(session)
        except Exception:
            await session.rollback()
            raise


async def banner_expiration_worker(stop_event: asyncio.Event) -> None:
    logger.info("premium_banner_expiration_worker_started", interval_sec=_EXPIRATION_INTERVAL_SEC)
    while not stop_event.is_set():
        try:
            await expire_sponsored_banners()
        except Exception as exc:
            logger.exception("premium_banner_expiration_failed", error=str(exc))
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=_EXPIRATION_INTERVAL_SEC)
        except asyncio.TimeoutError:
            continue
    logger.info("premium_banner_expiration_worker_stopped")
