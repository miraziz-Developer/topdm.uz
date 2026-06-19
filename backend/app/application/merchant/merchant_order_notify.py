"""Merchant Telegram — yangi buyurtma / lead xabarlari + inline amallar."""

from __future__ import annotations

import uuid
from typing import Any

from app.application.merchant.branding import powered_by_telegram_footer
from app.application.merchant.telegram_crm_notify import notify_merchant_telegram
from app.domain.interfaces.notifier_gateway import NotifierGateway
from app.infrastructure.bots.merchant_crm_links import crm_entry_url
from app.infrastructure.db.models import OrderModel, ShopModel

_ACTION_DEFS: dict[str, tuple[str, str]] = {
    "c": ("✅ Tasdiq", "confirmed"),
    "r": ("📦 Tayyor", "ready"),
    "x": ("❌ Rad", "cancelled"),
    "d": ("✔️ Olib ketdi", "completed"),
}

_TERMINAL_STATUSES = frozenset({"completed", "cancelled"})


def allowed_order_bot_actions(*, status: str, fulfillment_type: str = "pickup") -> list[str]:
    """Qaysi inline tugmalar ko'rinishi kerak — ketma-ketlik: tasdiq → tayyor → olib ketdi."""
    current = (status or "reserved").lower()
    if current in _TERMINAL_STATUSES:
        return []

    is_delivery = (fulfillment_type or "pickup").lower() == "delivery"

    if current in {"pending", "reserved", "new"}:
        return ["c", "x"]
    if current in {"confirmed", "preparing"}:
        return ["r", "x"]
    if current == "ready":
        return ["x"] if is_delivery else ["d", "x"]
    return ["x"]


def order_action_not_allowed_message(action: str, current_status: str) -> str:
    current = (current_status or "reserved").lower()
    if action == "d":
        if current in {"pending", "reserved", "new"}:
            return "Avval «✅ Tasdiq» bosishingiz kerak"
        if current in {"confirmed", "preparing"}:
            return "Avval «📦 Tayyor» bosishingiz kerak"
        return "Bu bosqichda olib ketildi deb belgilab bo'lmaydi"
    if action == "r":
        return "Avval buyurtmani tasdiqlang (✅ Tasdiq)"
    if action == "c":
        return "Buyurtma allaqachon tasdiqlangan"
    return "Bu amal hozirgi holatda mumkin emas"


def order_action_markup(
    shop_id: uuid.UUID,
    order_id: uuid.UUID,
    *,
    status: str = "reserved",
    fulfillment_type: str = "pickup",
) -> dict[str, Any]:
    oid = str(order_id)
    actions = allowed_order_bot_actions(status=status, fulfillment_type=fulfillment_type)
    rows: list[list[dict[str, Any]]] = []

    primary = [code for code in actions if code != "x"]
    if primary:
        rows.append(
            [{"text": _ACTION_DEFS[code][0], "callback_data": f"ord:{code}:{oid}"} for code in primary]
        )
    if "x" in actions:
        if len(primary) == 1:
            rows[-1].append({"text": _ACTION_DEFS["x"][0], "callback_data": f"ord:x:{oid}"})
        else:
            rows.append([{"text": _ACTION_DEFS["x"][0], "callback_data": f"ord:x:{oid}"}])

    rows.append(
        [
            {
                "text": "📱 CRM ochish",
                "web_app": {"url": crm_entry_url(shop_id, next_path="/dashboard/sales")},
            }
        ]
    )
    return {"inline_keyboard": rows}


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
    markup = order_action_markup(
        shop.id,
        order.id,
        status=str(order.status or "reserved"),
        fulfillment_type=str(getattr(order, "fulfillment_type", None) or "pickup"),
    )
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
