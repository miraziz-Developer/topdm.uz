from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.application.merchant.telegram_crm_notify import notify_merchant_telegram
from app.domain.interfaces.notifier_gateway import NotifierGateway
from app.infrastructure.repositories.route_stats_repo import MerchantAlertsRepository

logger = logging.getLogger(__name__)


async def run_merchant_smart_alerts(session: AsyncSession, notifier: NotifierGateway) -> int:
    """Send motivational Telegram nudges for idle uploads or unanswered leads."""
    settings = get_settings()
    repo = MerchantAlertsRepository(session)
    sent = 0

    for shop in await repo.shops_needing_upload_nudge(settings.merchant_alert_idle_days):
        alert_type = "idle_upload"
        if await repo.was_alert_sent_recently(shop.id, alert_type, hours=24):
            continue
        if not shop.telegram_chat_id:
            continue
        text = (
            "Bozorliii eslatmasi: 3 kundan beri yangi mahsulot yuklamadingiz.\n"
            "Rasm yoki ovozli xabar yuboring — mijozlar sizni topa olishi uchun katalogni yangilang."
        )
        try:
            await notify_merchant_telegram(
                notifier,
                chat_id=int(shop.telegram_chat_id),
                text=text,
                shop_id=shop.id,
                crm_next="/dashboard/products",
            )
            await repo.log_alert(shop.id, alert_type)
            sent += 1
        except Exception:
            logger.warning("smart_alert_upload_failed", extra={"shop_id": str(shop.id)})

    for shop, pending_count in await repo.shops_with_stale_leads(settings.merchant_alert_lead_hours):
        alert_type = "stale_leads"
        if await repo.was_alert_sent_recently(shop.id, alert_type, hours=24):
            continue
        if not shop.telegram_chat_id:
            continue
        text = (
            f"Bozorliii eslatmasi: {pending_count} ta mijoz so'rovi hali javobsiz.\n"
            "Tezroq javob bering — ishonch va savdo oshadi."
        )
        try:
            await notify_merchant_telegram(
                notifier,
                chat_id=int(shop.telegram_chat_id),
                text=text,
                shop_id=shop.id,
                crm_next="/dashboard/sales",
            )
            await repo.log_alert(shop.id, alert_type)
            sent += 1
        except Exception:
            logger.warning("smart_alert_leads_failed", extra={"shop_id": str(shop.id)})

    await session.commit()
    return sent
