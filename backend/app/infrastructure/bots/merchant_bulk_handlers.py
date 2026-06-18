"""Telegram bot — ommaviy chegirma."""

from __future__ import annotations

import logging
import re
import uuid

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import Message

from app.application.merchant.workspace_hub import MerchantWorkspaceHub
from app.infrastructure.bots.merchant_states import MerchantBotStates
from app.infrastructure.db.session import AsyncSessionFactory
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository

logger = logging.getLogger(__name__)
bulk_router = Router(name="merchant_bulk")

_PERCENT_RE = re.compile(r"(\d{1,2})\s*%?")


@bulk_router.message(Command("chegirma", "sale"))
async def cmd_bulk_discount(message: Message, state) -> None:
    if not message.from_user:
        return
    data = await state.get_data()
    shop_raw = data.get("shop_id")
    if not shop_raw:
        shop = None
        async with AsyncSessionFactory() as session:
            shop = await MarketplaceRepository(session).get_shop_by_telegram_chat_id(int(message.chat.id))
        if not shop:
            await message.answer("Avval /register bilan ro'yxatdan o'ting.")
            return
        shop_id = shop.id
    else:
        shop_id = uuid.UUID(str(shop_raw))

    args = (message.text or "").split(maxsplit=1)
    tail = args[1] if len(args) > 1 else ""
    match = _PERCENT_RE.search(tail)
    if not match:
        await message.answer(
            "Foydalanish: /chegirma 10\n"
            "Barcha faol mahsulotlarga 10% chegirma qo'llanadi."
        )
        return
    percent = int(match.group(1))
    if percent < 1 or percent > 90:
        await message.answer("Chegirma 1–90% oralig'ida bo'lishi kerak.")
        return

    async with AsyncSessionFactory() as session:
        hub = MerchantWorkspaceHub(session)
        try:
            result = await hub.bulk_discount(shop_id, percent_off=percent, product_ids=None)
            await session.commit()
        except Exception as exc:
            logger.warning("bulk_discount_bot_failed", extra={"error": str(exc)[:120]})
            await message.answer("Chegirma qo'llanmadi. CRM dan urinib ko'ring.")
            return

    await message.answer(
        f"✅ {percent}% chegirma qo'llandi.\n"
        f"Yangilangan mahsulotlar: {result.get('updated', 0)} ta"
    )


@bulk_router.message(MerchantBotStates.ready, F.text.regexp(r"(?i)^chegirma\s+\d+"))
async def text_bulk_discount(message: Message, state) -> None:
    await cmd_bulk_discount(message, state)
