"""Merchant Telegram — yangi buyurtma / lead xabarlari + inline amallar."""

from __future__ import annotations

import uuid
from typing import Any

from app.application.merchant.branding import powered_by_telegram_footer
from app.application.merchant.telegram_crm_notify import notify_merchant_telegram
from app.domain.interfaces.notifier_gateway import NotifierGateway
from app.infrastructure.bots.merchant_crm_links import crm_entry_url
from app.infrastructure.db.models import OrderModel, ShopModel


def order_action_markup(shop_id: uuid.UUID, order_id: uuid.UUID) -> dict[str, Any]:
    oid = str(order_id)
    return {
        "inline_keyboard": [
            [
                {"text": "✅ Tasdiq", "callback_data": f"ord:c:{oid}"},
                {"text": "📦 Tayyor", "callback_data": f"ord:r:{oid}"},
            ],
            [
                {"text": "❌ Rad", "callback_data": f"ord:x:{oid}"},
                {"text": "✔️ Olib ketdi", "callback_data": f"ord:d:{oid}"},
            ],
            [
                {
                    "text": "📱 CRM ochish",
                    "web_app": {"url": crm_entry_url(shop_id, next_path="/dashboard/sales")},
                }
            ],
        ]
    }


def _format_order_message(
    *,
    title: str,
    product_name: str,
    quantity: int,
    total_price: int | float,
    customer_phone: str,
    fulfillment_label: str,
    extra_lines: list[str] | None = None,
    order_id: uuid.UUID,
) -> str:
    lines = [
        title,
        f"📦 {product_name} ×{quantity}",
        f"💰 {int(total_price):,} so'm".replace(",", " "),
        f"📞 {customer_phone}",
        f"🚚 {fulfillment_label}",
    ]
    if extra_lines:
        lines.extend(extra_lines)
    lines.append(f"#{str(order_id)[:8]}")
    return "\n".join(lines)


async def notify_merchant_new_order(
    notifier: NotifierGateway | None,
    *,
    shop: ShopModel,
    order: OrderModel,
    product_name: str,
    fulfillment_label: str = "Olib ketish",
    extra_lines: list[str] | None = None,
) -> None:
    if not notifier or not shop.telegram_chat_id:
        return
    text = _format_order_message(
        title="🛒 Yangi buyurtma!",
        product_name=product_name,
        quantity=int(order.quantity or 1),
        total_price=float(order.total_price or 0),
        customer_phone=str(order.customer_phone or "—"),
        fulfillment_label=fulfillment_label,
        extra_lines=extra_lines,
        order_id=order.id,
    )
    markup = order_action_markup(shop.id, order.id)
    await notifier.send_merchant_crm(
        int(shop.telegram_chat_id),
        text + powered_by_telegram_footer(),
        shop_id=shop.id,
        crm_next="/dashboard/sales",
        reply_markup=markup,
    )


async def notify_merchant_new_lead(
    notifier: NotifierGateway | None,
    *,
    shop: ShopModel,
    customer_phone: str,
    message: str,
    source: str = "sayt",
) -> None:
    if not notifier or not shop.telegram_chat_id:
        return
    text = (
        f"💬 Yangi murojaat ({source})\n"
        f"📞 {customer_phone}\n"
        f"{message[:400]}"
    )
    await notify_merchant_telegram(
        notifier,
        chat_id=int(shop.telegram_chat_id),
        text=text,
        shop_id=shop.id,
        crm_next="/dashboard/sales",
    )


async def notify_first_order_pickup_tips(
    notifier: NotifierGateway | None,
    *,
    shop: ShopModel,
) -> None:
    if not notifier or not shop.telegram_chat_id:
        return
    text = (
        "🎉 Birinchi buyurtmangiz!\n\n"
        "Maslahat:\n"
        "• CRM → Sozlamalar: mijoz kelganda xabar yoqing\n"
        "• «Olib ketdi» — buyurtma avtomatik yopiladi\n"
        "• Keyingi buyurtmalar Telegramda shu tugmalar bilan boshqariladi"
    )
    await notify_merchant_telegram(
        notifier,
        chat_id=int(shop.telegram_chat_id),
        text=text,
        shop_id=shop.id,
        crm_next="/dashboard/sales",
    )
