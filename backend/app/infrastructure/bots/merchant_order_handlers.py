"""Telegram bot — buyurtma inline tugmalari (Tasdiq / Tayyor / Rad)."""

from __future__ import annotations

import logging
import uuid

from aiogram import F, Router
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from sqlalchemy import select

from app.application.marketplace.use_cases import MarketplaceUseCases
from app.application.merchant.merchant_order_notify import (
    allowed_order_bot_actions,
    order_action_markup,
    order_action_not_allowed_message,
)
from app.infrastructure.db.models import OrderModel
from app.infrastructure.db.session import AsyncSessionFactory
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository

logger = logging.getLogger(__name__)
order_router = Router(name="merchant_orders")

_STATUS_MAP = {
    "c": "confirmed",
    "r": "ready",
    "x": "cancelled",
    "d": "completed",
}

_STATUS_LABEL = {
    "confirmed": "✅ Tasdiqlandi",
    "ready": "📦 Tayyor",
    "cancelled": "❌ Bekor qilindi",
    "completed": "✔️ Olib ketdi",
}


def _markup_from_dict(markup: dict) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    for row in markup.get("inline_keyboard", []):
        buttons: list[InlineKeyboardButton] = []
        for btn in row:
            if "web_app" in btn:
                buttons.append(
                    InlineKeyboardButton(
                        text=btn["text"],
                        web_app=WebAppInfo(url=btn["web_app"]["url"]),
                    )
                )
            else:
                buttons.append(
                    InlineKeyboardButton(text=btn["text"], callback_data=btn["callback_data"])
                )
        rows.append(buttons)
    return InlineKeyboardMarkup(inline_keyboard=rows)


@order_router.callback_query(F.data.startswith("ord:"))
async def on_order_action(query: CallbackQuery) -> None:
    if not query.message or not query.from_user:
        await query.answer()
        return
    parts = (query.data or "").split(":", 2)
    if len(parts) != 3:
        await query.answer("Noto'g'ri buyruq", show_alert=True)
        return
    action, order_id_s = parts[1], parts[2]
    target_status = _STATUS_MAP.get(action)
    if not target_status:
        await query.answer("Noto'g'ri amal", show_alert=True)
        return
    try:
        order_id = uuid.UUID(order_id_s)
    except ValueError:
        await query.answer("Buyurtma topilmadi", show_alert=True)
        return

    chat_id = int(query.message.chat.id)
    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        shop = await repo.get_shop_by_telegram_chat_id(chat_id)
        if not shop:
            await query.answer("Do'kon ulanmagan", show_alert=True)
            return

        existing = (
            await session.execute(
                select(OrderModel).where(OrderModel.id == order_id, OrderModel.shop_id == shop.id)
            )
        ).scalar_one_or_none()
        if not existing:
            await query.answer("Buyurtma topilmadi", show_alert=True)
            return

        fulfillment_type = str(getattr(existing, "fulfillment_type", None) or "pickup")
        current_status = str(existing.status or "reserved")
        allowed = allowed_order_bot_actions(status=current_status, fulfillment_type=fulfillment_type)
        if action not in allowed:
            await query.answer(
                order_action_not_allowed_message(action, current_status),
                show_alert=True,
            )
            return

        from app.core.config import get_settings

        notifier = TelegramNotifierGateway(get_settings().telegram_bot_token)
        use_cases = MarketplaceUseCases(repo=repo, notifier=notifier)
        try:
            await use_cases.update_order_status(
                shop_id=shop.id,
                order_id=order_id,
                status=target_status,
            )
        except Exception as exc:
            logger.warning(
                "bot_order_status_failed",
                extra={"order_id": order_id_s, "error": str(exc)[:120]},
            )
            await query.answer("Status o'zgarmadi — CRM dan urinib ko'ring", show_alert=True)
            return

        new_status = target_status

    label = _STATUS_LABEL.get(target_status, target_status)
    await query.answer(label)
    try:
        base = query.message.text or ""
        markup = order_action_markup(
            shop.id,
            order_id,
            status=new_status,
            fulfillment_type=fulfillment_type,
        )
        await query.message.edit_text(
            f"{base}\n\n— {label}",
            reply_markup=_markup_from_dict(markup),
        )
    except Exception:
        pass
