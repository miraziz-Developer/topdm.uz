from __future__ import annotations

from typing import Any
from urllib.parse import quote

from app.core.config import Settings
from app.infrastructure.db.models import ShopModel


def _location_line(shop: ShopModel) -> str:
    parts: list[str] = []
    if shop.market_zone:
        parts.append(shop.market_zone.replace("_", " ").title())
    if shop.floor:
        parts.append(f"{shop.floor}-qavat")
    if shop.section:
        parts.append(shop.section)
    if shop.stall_number:
        parts.append(f"rasta {shop.stall_number}")
    return " · ".join(parts) if parts else ""


def _hours_line(hours: dict[str, Any]) -> str:
    open_t = (hours.get("open") or "09:00").strip()
    close_t = (hours.get("close") or "20:00").strip()
    busy = (hours.get("busy_note") or "").strip()
    line = f"Ish vaqti: {open_t} — {close_t}"
    if busy:
        line += f" ({busy})"
    return line


def build_product_share_message(
    shop: ShopModel,
    *,
    settings: Settings,
    product_name: str,
    price_uzs: int,
    hashtags: list[str] | None = None,
) -> str:
    site = settings.site_url.rstrip("/")
    shop_url = f"{site}/shop/{shop.slug}"
    tags = " ".join(f"#{t}" for t in (hashtags or [])[:6])
    location = _location_line(shop)
    loc_block = f"\n📍 {location}" if location else ""
    return (
        f"🛍 {product_name}\n"
        f"💰 {int(price_uzs):,} so'm\n"
        f"🏪 {shop.name}\n"
        f"🔗 {shop_url}{loc_block}\n"
        f"{tags}\n"
        f"Bozorliii orqali ko'ring va bron qiling 👇"
    ).replace(",", " ")


def build_share_kit(
    shop: ShopModel,
    *,
    settings: Settings,
    operating_hours: dict[str, Any] | None = None,
) -> dict[str, Any]:
    site = settings.site_url.rstrip("/")
    shop_url = f"{site}/shop/{shop.slug}"
    tg_bot = (settings.telegram_bot_username or "bozorliii_bot").lstrip("@")
    bot_deep_link = f"https://t.me/{tg_bot}?start=shop_{shop.id}"

    location = _location_line(shop)
    hours = operating_hours or {"open": "09:00", "close": "20:00", "busy_note": ""}
    hours_line = _hours_line(hours)

    location_block = f"📍 Joy: {location}\n" if location else ""
    hours_block = f"🕐 {hours_line}\n"

    invite_long = (
        f"Assalomu alaykum!\n\n"
        f"«{shop.name}» do'konimizni Bozorliii orqali onlayn ko'ring 👇\n"
        f"{shop_url}\n\n"
        f"Nima qilishingiz mumkin:\n"
        f"• Mahsulotlar va narxlarni ko'rish\n"
        f"• Ish vaqtini tekshirish (ochiq/yopiq)\n"
        f"• Bozorga yo'l topish (xarita)\n"
        f"• Savol yoki bron qoldirish\n\n"
        f"{hours_block}"
        f"{location_block}"
        f"QR kodni skanerlang yoki havolani bosing — hammasi telefoningizda!"
    ).strip()

    invite_short = (
        f"«{shop.name}» — Bozorliiida ko'ring 👇\n"
        f"{shop_url}\n"
        f"{hours_line}"
    )

    invite_group = (
        f"Do'kon tavsiyasi 📢\n"
        f"{shop.name}\n"
        f"Kirib qarang — bor-yo'qligini, narxni, ish vaqtini shu yerda ko'rasiz:\n"
        f"{shop_url}"
    )

    poster_text = (
        f"━━━━━━━━━━━━━━━━\n"
        f"  {shop.name.upper()}\n"
        f"  Bozorliii — onlayn vitrina\n"
        f"━━━━━━━━━━━━━━━━\n\n"
        f"Skanerlang 👇 yoki havola:\n"
        f"{shop_url}\n\n"
        f"{hours_line}\n"
        f"{('Joy: ' + location) if location else ''}\n\n"
        f"Mahsulotlar · narxlar · yo'l xaritasi"
    ).strip()

    messages = [
        {"id": "invite_long", "label": "Mijozga to'liq xabar", "text": invite_long},
        {"id": "invite_short", "label": "Qisqa SMS / chat", "text": invite_short},
        {"id": "invite_group", "label": "Guruh / kanal", "text": invite_group},
        {"id": "poster", "label": "Eshik / vitrina matni", "text": poster_text},
    ]

    wa_primary = invite_short
    shop_url_qr = f"{shop_url}?from=qr"
    encoded_url = quote(shop_url_qr, safe="")
    encoded_wa = quote(wa_primary, safe="")
    caption = (shop.name or "Do'kon").strip()[:48]
    caption_encoded = quote(caption, safe="")
    footer = quote("Skanerlang — katalogga kiring", safe="")
    qr_base = (
        f"https://quickchart.io/qr?ecLevel=M&margin=2&dark=1a1a2e&light=ffffff"
        f"&captionFontSize=18&caption={caption_encoded}&footerFontSize=13&footer={footer}"
    )

    return {
        "shop_id": str(shop.id),
        "shop_name": shop.name,
        "shop_url": shop_url,
        "shop_url_qr": shop_url_qr,
        "shop_slug": shop.slug,
        "qr_caption": caption,
        "location_line": location,
        "operating_hours": hours,
        "hours_line": hours_line,
        "telegram_bot_link": bot_deep_link,
        "whatsapp_share_url": f"https://wa.me/?text={encoded_wa}",
        "telegram_share_url": (
            f"https://t.me/share/url?url={encoded_url}&text={quote(shop.name, safe='')}"
        ),
        "qr_image_url": f"{qr_base}&size=480&text={encoded_url}",
        "qr_download_url": f"{qr_base}&size=900&text={encoded_url}",
        "qr_poster_url": f"{qr_base}&size=640&captionFontSize=22&text={encoded_url}",
        "copy_lines": [f"Do'kon: {shop.name}", f"Bozorliii: {shop_url}", hours_line],
        "share_messages": messages,
        "default_message": invite_long,
    }
