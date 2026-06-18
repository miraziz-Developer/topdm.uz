"""Merchant Telegram — matn + CRM WebApp tugmasi."""

from __future__ import annotations

import uuid

from app.application.merchant.branding import powered_by_telegram_footer
from app.domain.interfaces.notifier_gateway import NotifierGateway


async def notify_merchant_telegram(
    notifier: NotifierGateway | None,
    *,
    chat_id: int,
    text: str,
    shop_id: uuid.UUID,
    crm_next: str | None = None,
) -> None:
    if not notifier or not chat_id:
        return
    await notifier.send_merchant_crm(
        chat_id,
        text + powered_by_telegram_footer(),
        shop_id=shop_id,
        crm_next=crm_next,
    )
