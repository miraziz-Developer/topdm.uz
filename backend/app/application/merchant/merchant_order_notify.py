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
    "d": ("✔️ Yetkazildi", "completed"),
    "p": ("📷 QR Skaner", "completed"),
}

_TERMINAL_STATUSES = frozenset({"completed", "cancelled"})
_ONLINE_PAYMENT_METHODS = frozenset({"click"})


def is_click_payment_pending(
    order: OrderModel,
    *,
    checkout_status: str | None = None,
) -> bool:
    """Click tanlangan, lekin to'lov hali tushmagan — Tasdiq tugmasi bloklanadi."""
    method = (getattr(order, "payment_method", None) or "cash").lower()
    if method not in _ONLINE_PAYMENT_METHODS:
        return False
    if checkout_status == "success":
        return False
    if (order.status or "").lower() in _TERMINAL_STATUSES:
        return False
    return True


def allowed_order_bot_actions(
    *,
    status: str,
    fulfillment_type: str = "pickup",
    click_payment_pending: bool = False,
) -> list[str]:
    """Qaysi inline tugmalar ko'rinishi kerak — ketma-ketlik: tasdiq → tayyor → olib ketdi."""
    current = (status or "reserved").lower()
    if current in _TERMINAL_STATUSES:
        return []

    is_delivery = (fulfillment_type or "pickup").lower() == "delivery"

    if current in {"pending", "reserved", "new"}:
        if click_payment_pending:
            return ["x"]
        return ["c", "x"]
    if current in {"confirmed", "preparing"}:
        return ["r", "x"]
    if current == "ready":
        return ["d", "x"] if is_delivery else ["p", "x"]
    return ["x"]


def order_action_not_allowed_message(
    action: str,
    current_status: str,
    *,
    click_payment_pending: bool = False,
) -> str:
    current = (current_status or "reserved").lower()
    if action == "c" and click_payment_pending:
        return "Click to'lovi kutilmoqda — avval mijoz to'lashi kerak"
    if action == "d":
        return "Olib ketilgan deb belgilash faqat QR skaner orqali — 📷 QR Skaner tugmasini bosing"
    if action == "r":
        return "Avval buyurtmani tasdiqlang (✅ Tasdiq)"
    if action == "c":
        return "Buyurtma allaqachon tasdiqlangan"
    return "Bu amal hozirgi holatda mumkin emas"


def order_status_next_step_hint(*, status: str, fulfillment_type: str = "pickup") -> str:
    current = (status or "reserved").lower()
    is_delivery = (fulfillment_type or "pickup").lower() == "delivery"
    if current in {"pending", "reserved", "new"}:
        return "ℹ️ Keyingi qadam: buyurtmani qabul qilsangiz ✅ Tasdiq bosing"
    if current in {"confirmed", "preparing"}:
        return "ℹ️ Keyingi qadam: mahsulot tayyor bo'lganda 📦 Tayyor bosing"
    if current == "ready":
        if is_delivery:
            return "ℹ️ Keyingi qadam: kuryer yetkazgach buyurtmani yoping (CRM)"
        return "ℹ️ Keyingi qadam: mijoz kelganda faqat 📷 QR Skaner orqali yakunlang (CRM yoki botdagi skaner)"
    if current == "completed":
        return "✅ Buyurtma yakunlandi"
    if current == "cancelled":
        return "❌ Buyurtma bekor qilindi"
    return ""


def order_action_markup(
    shop_id: uuid.UUID,
    order_id: uuid.UUID,
    *,
    status: str = "reserved",
    fulfillment_type: str = "pickup",
    click_payment_pending: bool = False,
) -> dict[str, Any]:
    oid = str(order_id)
    actions = allowed_order_bot_actions(
        status=status,
        fulfillment_type=fulfillment_type,
        click_payment_pending=click_payment_pending,
    )
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

    if (status or "reserved").lower() == "ready" and (fulfillment_type or "pickup").lower() != "delivery":
        rows.insert(
            0,
            [
                {
                    "text": "📷 QR Skaner",
                    "web_app": {"url": crm_entry_url(shop_id, next_path="/scan")},
                }
            ],
        )

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
    hint = order_status_next_step_hint(
        status=str(order.status or "reserved"),
        fulfillment_type=str(getattr(order, "fulfillment_type", None) or "pickup"),
    )
    markup = order_action_markup(
        shop.id,
        order.id,
        status=str(order.status or "reserved"),
        fulfillment_type=str(getattr(order, "fulfillment_type", None) or "pickup"),
    )
    await notifier.send_merchant_crm(
        int(shop.telegram_chat_id),
        text + f"\n\n{hint}" + powered_by_telegram_footer(),
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
        "• Faqat 📷 QR Skaner orqali «olib ketildi» deb belgilanadi\n"
        "• Mijoz kelmasa 4 kundan keyin buyurtma avtomatik bekor qilinadi\n"
        "• Keyingi buyurtmalar Telegramda shu tugmalar bilan boshqariladi"
    )
    await notify_merchant_telegram(
        notifier,
        chat_id=int(shop.telegram_chat_id),
        text=text,
        shop_id=shop.id,
        crm_next="/dashboard/sales",
    )


async def notify_merchant_pending_payment(
    notifier: NotifierGateway | None,
    *,
    shop: ShopModel,
    order: OrderModel,
    product_name: str,
    fulfillment_label: str,
) -> None:
    if not notifier or not shop.telegram_chat_id:
        return
    text = _format_order_message(
        title="⏳ To'lov kutilmoqda (Click)",
        product_name=product_name,
        quantity=int(order.quantity or 1),
        total_price=float(order.total_price or 0),
        customer_phone=str(order.customer_phone or "—"),
        fulfillment_label=fulfillment_label,
        extra_lines=[
            "💳 Mijoz Click orqali to'lashi kerak",
            "✅ To'lov tushgach buyurtma avtomatik tasdiqlanadi",
            "ℹ️ Tasdiqlash shart emas — faqat to'lovni kuting",
        ],
        order_id=order.id,
    )
    await notify_merchant_telegram(
        notifier,
        chat_id=int(shop.telegram_chat_id),
        text=text,
        shop_id=shop.id,
        crm_next="/dashboard/sales",
    )


async def notify_merchant_payment_received(
    notifier: NotifierGateway | None,
    *,
    shop: ShopModel,
    order: OrderModel,
    product_name: str,
    fulfillment_label: str,
    extra_lines: list[str] | None = None,
) -> None:
    """Click to'lovi muvaffaqiyatli — to'liq buyurtma xabari + boshqaruv tugmalari."""
    lines = ["✅ Onlayn to'lov qabul qilindi"]
    if extra_lines:
        lines.extend(extra_lines)
    await notify_merchant_new_order(
        notifier,
        shop=shop,
        order=order,
        product_name=product_name,
        fulfillment_label=fulfillment_label,
        extra_lines=lines,
    )


async def notify_merchant_order_cancelled(
    notifier: NotifierGateway | None,
    *,
    shop: ShopModel,
    order: OrderModel,
    product_name: str,
    reason: str,
) -> None:
    if not notifier or not shop.telegram_chat_id:
        return
    text = (
        f"❌ Buyurtma bekor qilindi\n"
        f"📦 {product_name} ×{int(order.quantity or 1)}\n"
        f"📞 {order.customer_phone or '—'}\n"
        f"📝 {reason[:200]}\n"
        f"#{str(order.id)[:8]}"
    )
    await notify_merchant_telegram(
        notifier,
        chat_id=int(shop.telegram_chat_id),
        text=text,
        shop_id=shop.id,
        crm_next="/dashboard/sales",
    )


async def notify_merchant_payment_method_changed(
    notifier: NotifierGateway | None,
    *,
    shop: ShopModel,
    order: OrderModel,
    product_name: str,
    old_method_label: str,
    new_method_label: str,
    fulfillment_label: str,
) -> None:
    if not notifier or not shop.telegram_chat_id:
        return
    text = (
        f"💳 To'lov turi o'zgartirildi\n"
        f"📦 {product_name} ×{int(order.quantity or 1)}\n"
        f"📞 {order.customer_phone or '—'}\n"
        f"Eski: {old_method_label}\n"
        f"Yangi: {new_method_label}\n"
        f"🚚 {fulfillment_label}\n"
        f"Mijoz do'konda to'laydi\n"
        f"#{str(order.id)[:8]}"
    )
    hint = order_status_next_step_hint(
        status=str(order.status or "reserved"),
        fulfillment_type=str(getattr(order, "fulfillment_type", None) or "pickup"),
    )
    markup = order_action_markup(
        shop.id,
        order.id,
        status=str(order.status or "reserved"),
        fulfillment_type=str(getattr(order, "fulfillment_type", None) or "pickup"),
    )
    await notifier.send_merchant_crm(
        int(shop.telegram_chat_id),
        text + f"\n\n{hint}" + powered_by_telegram_footer(),
        shop_id=shop.id,
        crm_next="/dashboard/sales",
        reply_markup=markup,
    )


async def notify_merchant_order_rescheduled(
    notifier: NotifierGateway | None,
    *,
    shop: ShopModel,
    order: OrderModel,
    product_name: str,
    old_schedule: str,
    new_schedule: str,
) -> None:
    if not notifier or not shop.telegram_chat_id:
        return
    text = (
        f"📅 Olib ketish vaqti o'zgartirildi\n"
        f"📦 {product_name} ×{int(order.quantity or 1)}\n"
        f"📞 {order.customer_phone or '—'}\n"
        f"Eski: {old_schedule}\n"
        f"Yangi: {new_schedule}\n"
        f"#{str(order.id)[:8]}"
    )
    hint = order_status_next_step_hint(
        status=str(order.status or "reserved"),
        fulfillment_type=str(getattr(order, "fulfillment_type", None) or "pickup"),
    )
    markup = order_action_markup(
        shop.id,
        order.id,
        status=str(order.status or "reserved"),
        fulfillment_type=str(getattr(order, "fulfillment_type", None) or "pickup"),
    )
    await notifier.send_merchant_crm(
        int(shop.telegram_chat_id),
        text + f"\n\n{hint}" + powered_by_telegram_footer(),
        shop_id=shop.id,
        crm_next="/dashboard/sales",
        reply_markup=markup,
    )
