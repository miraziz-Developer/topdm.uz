from __future__ import annotations

import asyncio
import io
import logging
import uuid

from aiogram import Bot, F, Router
from aiogram.filters import StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message

from app.application.merchant.category_resolver import enrich_attrs_with_category, resolve_category_from_attrs
from app.application.merchant.category_size_presets import (
    size_group_for_attrs,
    size_group_label,
    size_presets_for_attrs,
)
from app.application.merchant.product_hashtags import (
    format_hashtags_display,
    hashtags_for_publish,
    parse_hashtags_from_text,
    suggest_hashtags_from_attrs,
)
from app.application.merchant.product_service import (
    MerchantProductService,
    PublishPendingProductError,
    PublishPendingProductRequest,
)
from app.application.merchant.product_vision_enrichment import analyze_product_photo
from app.application.merchant.telegram_variant_draft import (
    add_color_photo,
    apply_all_sizes_to_colors,
    draft_summary,
    empty_variant_draft,
    ensure_first_color,
    get_variant_draft,
    set_fallback_stock,
    set_variant_draft,
    toggle_size,
)
from app.core.config import get_settings
from app.infrastructure.bots.merchant_states import MerchantBotStates
from app.infrastructure.cache.redis_gateway import RedisCacheGateway
from app.infrastructure.db.session import AsyncSessionFactory
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository

logger = logging.getLogger(__name__)
prod_router = Router(name="merchant_product")
_AI_VISION_TIMEOUT_SEC = 45.0
_PUBLISH_TIMEOUT_SEC = 90.0

# Tahrir/qo'lda kiritish holatlari — bu yerda menyu tugmalari yoki /start "boshi berk" bo'lib qolmasin.
_EDIT_ESCAPE_STATES = (
    MerchantBotStates.product_edit_name,
    MerchantBotStates.product_edit_price,
    MerchantBotStates.product_edit_hashtags,
    MerchantBotStates.product_manual_photo,
    MerchantBotStates.product_manual_name,
    MerchantBotStates.product_manual_price,
    MerchantBotStates.product_add_color_name,
    MerchantBotStates.product_add_color_photo,
    MerchantBotStates.product_edit_stock,
    MerchantBotStates.stock_set_quantity,
)
_EDIT_ESCAPE_TEXTS = {
    "Mahsulot yuklash (rasm)",
    "📸 Mahsulot qo'shish",
    "Mahsulot qo'lda",
    "Ombor yangilash",
    "/start",
    "/cancel",
    "/bekor",
    "Bekor",
    "bekor",
    "❌ Bekor",
}


@prod_router.message(StateFilter(*_EDIT_ESCAPE_STATES), F.text.in_(_EDIT_ESCAPE_TEXTS))
async def escape_edit_state(message: Message, state: FSMContext) -> None:
    """Tahrir holatida menyu tugmasi/`/start` bosilsa — boshi berk ko'chadan chiqarish."""
    await state.set_state(MerchantBotStates.ready)
    await message.answer(
        "Tahrir bekor qilindi. ✅\n"
        "Menyudan amalni tanlang yoki yangi mahsulot rasmini yuboring."
    )


async def _consume_voice_prefill(chat_id: int, attrs: dict) -> bool:
    """Oldindan ovoz orqali kiritilgan nom/narx/rang ma'lumotini rasmga birlashtiradi.

    Ovozli xabar rasmsiz bo'lgani uchun ma'lumot Redis'da vaqtincha saqlanadi va
    do'konchi mahsulot rasmini yuborganda shu yerda qo'llaniladi.
    """
    cache = RedisCacheGateway()
    key = f"voice_prefill:chat:{chat_id}"
    try:
        prefill = await cache.get(key)
    except Exception:
        return False
    if not isinstance(prefill, dict):
        return False
    applied = False
    name = str(prefill.get("product_name") or "").strip()
    if name and str(attrs.get("product_name") or "").strip() in {"", "Yangi mahsulot"}:
        attrs["product_name"] = name
        applied = True
    if prefill.get("price_uzs") and not attrs.get("price_uzs"):
        attrs["price_uzs"] = prefill["price_uzs"]
        applied = True
    for field in ("color", "size", "material"):
        if prefill.get(field) and not attrs.get(field):
            attrs[field] = prefill[field]
            applied = True
    try:
        await cache.delete(key)
    except Exception:
        pass
    return applied


def _manual_fallback_attrs(*, reason: str | None = None) -> dict:
    attrs: dict = {
        "product_name": "Yangi mahsulot",
        "manual": True,
        "category_hint": "boshqa",
    }
    if reason:
        attrs["ai_skip_reason"] = reason
    return attrs


def _parse_price_from_caption(caption: str | None) -> int | None:
    """Izohdan narxni o'qiydi. Birinchi katta raqam (≥100) narx hisoblanadi."""
    if not caption:
        return None
    import re
    # Barcha raqam guruhlarini topamiz (bo'sh joy yoki vergul bilan ajratilgan ham)
    numbers = [int(re.sub(r"[\s,_]", "", m)) for m in re.findall(r"\d[\d\s,_]*\d|\d", caption)]
    # Narx ≥ 100 bo'lgan birinchi raqam
    for n in numbers:
        if n >= 100:
            return n
    return None


def _parse_stock_from_caption(caption: str | None) -> int | None:
    """Izohdan dona/miqdorni o'qiydi.
    
    Qo'llab-quvvatlanadigan formatlar:
    - "10 dona", "10ta", "10 ta", "10 штук", "10 шт"
    - "dona:10", "miqdor:10"
    - Agar faqat 2 ta raqam bo'lsa — kichigi dona hisoblanadi
    """
    if not caption:
        return None
    import re
    lower = caption.lower()
    # "10 dona", "10ta", "10 ta", "10 шт", "10 штук", "10 piece"
    m = re.search(r"(\d+)\s*(?:dona|ta\b|шт|штук|piece|pcs|нта|нтa)", lower)
    if m:
        val = int(m.group(1))
        return val if 1 <= val <= 99_999 else None
    # "dona:10" yoki "miqdor:10"
    m = re.search(r"(?:dona|miqdor|qty|count)\s*[:\-]\s*(\d+)", lower)
    if m:
        val = int(m.group(1))
        return val if 1 <= val <= 99_999 else None
    # Agar 2 ta raqam bo'lsa va biri narx (≥100), ikkinchisi kichik (≤999) — kichigi dona
    numbers = [int(re.sub(r"[\s,_]", "", x)) for x in re.findall(r"\d[\d\s,_]*\d|\d", caption)]
    if len(numbers) == 2:
        big = max(numbers)
        small = min(numbers)
        if big >= 100 and 1 <= small <= 999:
            return small
    return None


async def _resolve_shop_id(state: FSMContext, chat_id: int) -> uuid.UUID | None:
    data = await state.get_data()
    shop_raw = data.get("shop_id")
    if shop_raw:
        try:
            return uuid.UUID(str(shop_raw))
        except ValueError:
            pass

    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        shop = await repo.get_shop_by_telegram_chat_id(chat_id)
        if not shop:
            return None
        await state.set_state(MerchantBotStates.ready)
        await state.update_data(shop_id=str(shop.id))
        return shop.id


async def _shop_verification_message(shop_id: uuid.UUID) -> str | None:
    """Tasdiqlanmagan do'kon uchun xabar; tasdiqlangan bo'lsa None."""
    async with AsyncSessionFactory() as session:
        shop = await MarketplaceRepository(session).get_shop(shop_id)
    if not shop or shop.is_verified:
        return None
    if shop.verification_status == "rejected":
        reason = (shop.verification_reason or "").strip()
        return f"❌ Ariza rad etildi.{f' {reason}' if reason else ''}"
    return (
        "⏳ Do'kon hali tasdiqlanmagan. Moderator arizangizni ko'rib chiqmoqda (24 soat ichida).\n"
        "Tasdiqlangach mahsulot qo'shishingiz mumkin."
    )


def _cb(data: str) -> str:
    """Telegram inline callback_data ≤ 64 bayt."""
    if len(data.encode("utf-8")) > 64:
        raise ValueError(f"callback_data too long ({len(data.encode('utf-8'))} B): {data[:48]}")
    return data


async def _pending_id_from_state(state: FSMContext, *, explicit: str | None = None) -> str | None:
    if explicit:
        return explicit
    data = await state.get_data()
    return data.get("active_pending_id") or data.get("edit_pending_id")


def _format_preview(attrs: dict, *, category_name: str | None = None) -> str:
    name = attrs.get("product_name") or attrs.get("category") or "Mahsulot"
    price = attrs.get("price_uzs")
    price_line = f"{int(price):,} so'm".replace(",", " ") if price else "narxni kiriting"
    cat_line = category_name or attrs.get("category_label") or attrs.get("category_hint") or attrs.get("category") or "—"
    if attrs.get("category_id") and attrs.get("category_auto"):
        cat_line = f"{cat_line} (AI tanladi)"
    elif not attrs.get("category_id") and cat_line not in {"—", ""}:
        cat_line = f"{cat_line} — «Kategoriya» tugmasidan tasdiqlang"
    draft = get_variant_draft(attrs)
    images_line, sizes_line = draft_summary(draft)
    stock = int(draft.get("fallback_stock") or 0)
    stock_line = f"{stock} dona" if stock > 0 else "kiritilmagan"
    tags_line = format_hashtags_display(hashtags_for_publish(attrs))
    return (
        f"Mahsulot: {name}\n"
        f"Kategoriya: {cat_line}\n"
        f"Narx: {price_line}\n"
        f"Ombor: {stock_line}\n"
        f"Rasmlar: {images_line}\n"
        f"Razmerlar: {sizes_line}\n"
        f"Hashtaglar: {tags_line}\n\n"
        "Tasdiqlang yoki o'zgartiring:"
    )


def _product_keyboard(pending_id: str, *, has_category: bool) -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton(text="Kategoriya", callback_data=f"prod:cat:{pending_id}"),
            InlineKeyboardButton(text="Narx", callback_data=f"prod:price:{pending_id}"),
        ],
        [
            InlineKeyboardButton(text="Nom", callback_data=f"prod:name:{pending_id}"),
            InlineKeyboardButton(text="Razmerlar", callback_data=f"prod:sizes:{pending_id}"),
        ],
        [
            InlineKeyboardButton(text="Hashtaglar", callback_data=f"prod:ht:{pending_id}"),
            InlineKeyboardButton(text="Ombor", callback_data=f"prod:stock:{pending_id}"),
        ],
        [
            InlineKeyboardButton(text="+ Rang/rasm", callback_data=f"prod:addcolor:{pending_id}"),
        ],
        [
            InlineKeyboardButton(text="Yuklash", callback_data=f"prod:pub:{pending_id}"),
        ],
        [InlineKeyboardButton(text="Bekor", callback_data=f"prod:cancel:{pending_id}")],
    ]
    if not has_category:
        rows[0][0] = InlineKeyboardButton(text="Kategoriya tanlang", callback_data=f"prod:cat:{pending_id}")
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _size_keyboard(pending_id: str, draft: dict, presets: list[str]) -> InlineKeyboardMarkup:
    selected = set(draft.get("all_sizes") or [])
    rows: list[list[InlineKeyboardButton]] = []
    chunk: list[InlineKeyboardButton] = []
    for size in presets:
        mark = "✓ " if size in selected else ""
        chunk.append(InlineKeyboardButton(text=f"{mark}{size}", callback_data=f"prod:sz:{pending_id}:{size}"))
        if len(chunk) == 4:
            rows.append(chunk)
            chunk = []
    if chunk:
        rows.append(chunk)
    rows.append([InlineKeyboardButton(text="Orqaga", callback_data=f"prod:back:{pending_id}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _reset_size_selection(draft: dict) -> dict:
    out = get_variant_draft({"variant_draft": draft})
    out["all_sizes"] = []
    out["colors"] = [{**row, "sizes": []} for row in out["colors"]]
    return out


async def _apply_category_size_presets(
    session,
    attrs: dict,
    *,
    reset_sizes: bool = False,
) -> dict:
    draft = get_variant_draft(attrs)
    if reset_sizes:
        draft = _reset_size_selection(draft)
    group = await size_group_for_attrs(session, attrs)
    merged = set_variant_draft(attrs, draft)
    merged["size_group"] = group
    return merged


def _attach_variant_draft(
    attrs: dict,
    *,
    telegram_file_id: str,
    color_name: str | None = None,
) -> dict:
    draft = get_variant_draft(attrs)
    if not draft.get("colors"):
        draft = ensure_first_color(
            empty_variant_draft(),
            color_name=color_name or str(attrs.get("color") or "Asosiy"),
            telegram_file_id=telegram_file_id,
        )
    else:
        draft = ensure_first_color(
            draft,
            color_name=color_name or str(attrs.get("color") or "Asosiy"),
            telegram_file_id=telegram_file_id,
        )
    merged = set_variant_draft(attrs, draft)
    return merged


def _category_button_label(cat) -> str:
    label = f"{cat.icon} {cat.name}" if getattr(cat, "icon", None) else cat.name
    return label[:32]


async def _category_keyboard(session, pending_id: str, page: int = 0) -> InlineKeyboardMarkup:
    repo = MarketplaceRepository(session)
    cats = await repo.list_root_categories(limit=40)
    page_size = 8
    start = page * page_size
    chunk = cats[start : start + page_size]
    rows: list[list[InlineKeyboardButton]] = []
    for cat in chunk:
        rows.append(
            [
                InlineKeyboardButton(
                    text=_category_button_label(cat),
                    callback_data=_cb(f"prod:sub:{cat.id}"),
                )
            ]
        )
    nav: list[InlineKeyboardButton] = []
    if start > 0:
        nav.append(InlineKeyboardButton(text="«", callback_data=f"prod:catpage:{pending_id}:{page - 1}"))
    if start + page_size < len(cats):
        nav.append(InlineKeyboardButton(text="»", callback_data=f"prod:catpage:{pending_id}:{page + 1}"))
    if nav:
        rows.append(nav)
    rows.append([InlineKeyboardButton(text="Orqaga", callback_data=f"prod:back:{pending_id}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


async def _subcategory_keyboard(
    session,
    pending_id: str,
    parent_id: str,
    page: int = 0,
) -> tuple[InlineKeyboardMarkup, str]:
    from app.infrastructure.db.models import CategoryModel

    repo = MarketplaceRepository(session)
    parent = await session.get(CategoryModel, uuid.UUID(parent_id))
    parent_label = _category_button_label(parent) if parent else "Bo'lim"
    cats = await repo.list_child_categories(uuid.UUID(parent_id), limit=40)
    page_size = 8
    start = page * page_size
    chunk = cats[start : start + page_size]
    rows: list[list[InlineKeyboardButton]] = []
    for cat in chunk:
        rows.append(
            [
                InlineKeyboardButton(
                    text=cat.name[:32],
                    callback_data=_cb(f"prod:set:{cat.id}"),
                )
            ]
        )
    nav: list[InlineKeyboardButton] = []
    if start > 0:
        nav.append(
            InlineKeyboardButton(
                text="«",
                callback_data=_cb(f"prod:sp:{parent_id}:{page - 1}"),
            )
        )
    if start + page_size < len(cats):
        nav.append(
            InlineKeyboardButton(
                text="»",
                callback_data=_cb(f"prod:sp:{parent_id}:{page + 1}"),
            )
        )
    if nav:
        rows.append(nav)
    rows.append([InlineKeyboardButton(text="← Bo'limlar", callback_data=f"prod:cat:{pending_id}")])
    return InlineKeyboardMarkup(inline_keyboard=rows), parent_label


@prod_router.message(MerchantBotStates.ready, F.text.in_({"Mahsulot yuklash (rasm)", "📸 Mahsulot qo'shish"}))
async def on_product_upload_menu(message: Message, state: FSMContext) -> None:
    shop_id = await _resolve_shop_id(state, int(message.chat.id))
    if not shop_id:
        await message.answer("Avval /register yoki /start shop_<UUID> bilan ulanishni yakunlang.")
        return
    blocked = await _shop_verification_message(shop_id)
    if blocked:
        await message.answer(blocked)
        return
    await message.answer(
        "📸 Mahsulot rasmini yuboring!\n\n"
        "💡 Izohga narx va dona sonini yozing:\n"
        "   Masalan: «150000 10 dona» yoki «150000»\n\n"
        "AI nom, kategoriya va narxni avtomatik aniqlaydi.\n"
        "Keyin «Yuklash» tugmasini bosasiz — tayyor!"
    )


@prod_router.message(MerchantBotStates.ready, F.text == "Mahsulot qo'lda")
async def on_manual_product_start(message: Message, state: FSMContext) -> None:
    shop_id = await _resolve_shop_id(state, int(message.chat.id))
    if not shop_id:
        await message.answer("Avval /register yoki /start shop_<UUID> bilan ulanishni yakunlang.")
        return
    blocked = await _shop_verification_message(shop_id)
    if blocked:
        await message.answer(blocked)
        return
    await state.set_state(MerchantBotStates.product_manual_photo)
    await message.answer("Mahsulot rasmini yuboring (AI ishlatilmaydi).")


@prod_router.message(MerchantBotStates.product_manual_photo, F.photo)
async def on_manual_product_photo(message: Message, state: FSMContext, bot: Bot) -> None:
    if not message.photo or not message.from_user:
        return
    shop_id = await _resolve_shop_id(state, int(message.chat.id))
    if not shop_id:
        await message.answer("Avval /register yoki /start shop_<UUID> bilan ulanishni yakunlang.")
        await state.set_state(MerchantBotStates.ready)
        return
    blocked = await _shop_verification_message(shop_id)
    if blocked:
        await message.answer(blocked)
        return
    photo = message.photo[-1]
    buf = io.BytesIO()
    try:
        await bot.download(photo, destination=buf)
    except Exception:
        await message.answer("Rasmni yuklab bo'lmadi.")
        return
    raw = buf.getvalue()
    async with AsyncSessionFactory() as session:
        attrs = _manual_fallback_attrs()
        caption_price = _parse_price_from_caption(message.caption)
        if caption_price:
            attrs["price_uzs"] = caption_price
        attrs["moderation"] = {"allowed": True, "reason": "manual_review", "flags": []}
        attrs = _attach_variant_draft(attrs, telegram_file_id=photo.file_id)
        repo = MarketplaceRepository(session)
        row = await repo.create_merchant_pending_product(
            shop_id=shop_id,
            vision_attributes=attrs,
            telegram_user_id=int(message.from_user.id),
            telegram_chat_id=int(message.chat.id),
            telegram_file_id=photo.file_id,
        )
        await session.commit()
    await state.update_data(manual_pending_id=str(row.id))
    await state.set_state(MerchantBotStates.product_manual_name)
    await message.answer("Mahsulot nomini kiriting:")


@prod_router.message(MerchantBotStates.product_manual_name, F.text)
async def on_manual_product_name(message: Message, state: FSMContext) -> None:
    name = (message.text or "").strip()
    if len(name) < 2:
        await message.answer("Nom kamida 2 belgi bo'lishi kerak.")
        return
    await state.update_data(manual_product_name=name)
    await state.set_state(MerchantBotStates.product_manual_price)
    await message.answer("Narxni kiriting (so'm, faqat raqam):")


@prod_router.message(MerchantBotStates.product_manual_price, F.text)
async def on_manual_product_price(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    pending_id = data.get("manual_pending_id")
    name = (data.get("manual_product_name") or "").strip()
    if not pending_id:
        await state.set_state(MerchantBotStates.ready)
        await message.answer("Qoralama topilmadi. Qayta boshlang.")
        return
    digits = "".join(c for c in (message.text or "") if c.isdigit())
    if not digits:
        await message.answer("Faqat raqam kiriting.")
        return
    price = int(digits)
    shop_id = await _resolve_shop_id(state, int(message.chat.id))
    if not shop_id:
        await message.answer("Chat do'konga ulanmagan. /start bilan qayta ulang.")
        await state.set_state(MerchantBotStates.ready)
        return
    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        row = await repo.get_pending_product(uuid.UUID(pending_id), shop_id=shop_id)
        if not row:
            await message.answer("Qoralama topilmadi.")
            await state.set_state(MerchantBotStates.ready)
            return
        attrs = dict(row.vision_attributes or {})
        attrs["product_name"] = name
        attrs["price_uzs"] = price
        attrs["manual"] = True
        await repo.update_pending_product(row, vision_attributes=attrs)
        await session.commit()
    await state.set_state(MerchantBotStates.ready)
    await state.update_data(active_pending_id=pending_id)
    await message.answer(
        "Qo'lda kiritildi. Kategoriyani tanlang va yuklang:\n\n"
        + _format_preview(attrs, category_name=attrs.get("category_label")),
        reply_markup=_product_keyboard(pending_id, has_category=bool(attrs.get("category_id"))),
    )


@prod_router.message(MerchantBotStates.ready, F.photo)
async def on_product_photo(message: Message, state: FSMContext, bot: Bot) -> None:
    if not message.photo or not message.from_user:
        return
    shop_id = await _resolve_shop_id(state, int(message.chat.id))
    if not shop_id:
        await message.answer("Avval /register yoki /start shop_<UUID> bilan ulanishni yakunlang.")
        return
    blocked = await _shop_verification_message(shop_id)
    if blocked:
        await message.answer(blocked)
        return
    photo = message.photo[-1]
    buf = io.BytesIO()
    try:
        await bot.download(photo, destination=buf)
    except Exception:
        await message.answer("Rasmni yuklab bo'lmadi.")
        return
    raw = buf.getvalue()
    caption_hint = ""
    if not message.caption:
        caption_hint = "\n💡 Maslahat: keyingi safar rasm izohiga narx yozing (masalan: 150000)"
    status_msg = await message.answer("AI mahsulotni tahlil qilmoqda…" + caption_hint)
    ai_note = ""
    attrs: dict

    try:
        async with asyncio.timeout(_AI_VISION_TIMEOUT_SEC):
            async with AsyncSessionFactory() as session:
                try:
                    attrs = await analyze_product_photo(raw)
                    if str(attrs.get("product_name") or "").strip() in {"", "Yangi mahsulot"}:
                        ai_note = "AI qisman ishladi — nom/narxni tekshiring.\n\n"
                except Exception:
                    logger.exception("product_photo_vision_failed")
                    attrs = _manual_fallback_attrs(reason="vision_failed")
                    ai_note = "AI ishlamadi — qo'lda to'ldiring.\n\n"
                attrs["moderation"] = {"allowed": True, "reason": "manual_review", "flags": []}
                caption_price = _parse_price_from_caption(message.caption)
                if caption_price and not attrs.get("price_uzs"):
                    attrs["price_uzs"] = caption_price
                caption_stock = _parse_stock_from_caption(message.caption)
                voice_applied = await _consume_voice_prefill(int(message.chat.id), attrs)
                if voice_applied and not ai_note:
                    ai_note = "🎙 Ovozli ma'lumot qo'shildi — tekshirib, «Yuklash» bosing.\n\n"
                attrs = _attach_variant_draft(
                    attrs,
                    telegram_file_id=photo.file_id,
                    color_name=str(attrs.get("color") or ""),
                )
                # Izohdan olingan dona sonini variant draft ga qo'shamiz
                if caption_stock:
                    draft_with_stock = set_fallback_stock(get_variant_draft(attrs), caption_stock)
                    attrs = set_variant_draft(attrs, draft_with_stock)
                attrs = await enrich_attrs_with_category(session, attrs)
                if attrs.get("category_id"):
                    attrs = await _apply_category_size_presets(session, attrs, reset_sizes=False)
                    if attrs.get("category_auto") and not ai_note:
                        ai_note = "Kategoriya avtomatik tanlandi — tekshirib, «Yuklash» bosing.\n\n"
                if not attrs.get("hashtags"):
                    attrs["hashtags"] = suggest_hashtags_from_attrs(attrs)

                repo = MarketplaceRepository(session)
                row = await repo.create_merchant_pending_product(
                    shop_id=shop_id,
                    vision_attributes=attrs,
                    telegram_user_id=int(message.from_user.id),
                    telegram_chat_id=int(message.chat.id),
                    telegram_file_id=photo.file_id,
                )
                await session.commit()
    except TimeoutError:
        logger.warning("product_photo_ai_timeout")
        async with AsyncSessionFactory() as session:
            attrs = _manual_fallback_attrs(reason="timeout")
            caption_price = _parse_price_from_caption(message.caption)
            if caption_price:
                attrs["price_uzs"] = caption_price
            await _consume_voice_prefill(int(message.chat.id), attrs)
            attrs = _attach_variant_draft(attrs, telegram_file_id=photo.file_id)
            attrs = await enrich_attrs_with_category(session, attrs)
            if attrs.get("category_id"):
                attrs = await _apply_category_size_presets(session, attrs, reset_sizes=False)
            if not attrs.get("hashtags"):
                attrs["hashtags"] = suggest_hashtags_from_attrs(attrs)
            repo = MarketplaceRepository(session)
            row = await repo.create_merchant_pending_product(
                shop_id=shop_id,
                vision_attributes=attrs,
                telegram_user_id=int(message.from_user.id),
                telegram_chat_id=int(message.chat.id),
                telegram_file_id=photo.file_id,
            )
            await session.commit()
        ai_note = "AI javob bermadi (vaqt tugadi) — qo'lda to'ldiring.\n\n"
        if attrs.get("category_id"):
            ai_note = "Kategoriya avtomatik tanlandi — qolganini to'ldiring.\n\n"
    except Exception:
        logger.exception("product_photo_failed")
        try:
            await status_msg.edit_text("Xatolik yuz berdi. «Mahsulot qo'lda» tugmasi bilan qayta urinib ko'ring.")
        except Exception:
            await message.answer("Xatolik yuz berdi. «Mahsulot qo'lda» tugmasi bilan qayta urinib ko'ring.")
        return

    await state.update_data(active_pending_id=str(row.id))
    await status_msg.edit_text(
        ai_note + _format_preview(attrs, category_name=attrs.get("category_label")),
        reply_markup=_product_keyboard(str(row.id), has_category=bool(attrs.get("category_id"))),
    )


@prod_router.callback_query(F.data.startswith("prod:catpage:"))
async def prod_cat_page(query: CallbackQuery) -> None:
    parts = (query.data or "").split(":")
    if len(parts) < 4:
        await query.answer()
        return
    pending_id, page_s = parts[2], parts[3]
    try:
        page = int(page_s)
    except (TypeError, ValueError):
        await query.answer()
        return
    async with AsyncSessionFactory() as session:
        kb = await _category_keyboard(session, pending_id, page=page)
    if query.message:
        await query.message.edit_reply_markup(reply_markup=kb)
    await query.answer()


@prod_router.callback_query(F.data.startswith("prod:cat:"))
async def prod_pick_category(query: CallbackQuery, state: FSMContext) -> None:
    pending_id = (query.data or "").split(":", 2)[2]
    await state.update_data(active_pending_id=pending_id)
    async with AsyncSessionFactory() as session:
        kb = await _category_keyboard(session, pending_id, page=0)
    if query.message:
        try:
            await query.message.edit_text(
                "Avval bo'limni tanlang (Ayollar / Erkaklar / Bolalar...):",
                reply_markup=kb,
            )
        except Exception:
            logger.exception("prod_pick_category_edit_failed")
            await query.message.answer(
                "Avval bo'limni tanlang (Ayollar / Erkaklar / Bolalar...):",
                reply_markup=kb,
            )
    await query.answer()


@prod_router.callback_query(F.data.startswith("prod:sub:"))
async def prod_pick_subcategory(query: CallbackQuery, state: FSMContext) -> None:
    parts = (query.data or "").split(":", 2)
    if len(parts) < 3:
        await query.answer()
        return
    parent_id = parts[2]
    pending_id = await _pending_id_from_state(state)
    if not pending_id:
        await query.answer("Qoralama topilmadi — rasmni qayta yuboring", show_alert=True)
        return
    async with AsyncSessionFactory() as session:
        kb, parent_label = await _subcategory_keyboard(session, pending_id, parent_id, page=0)
    if query.message:
        await query.message.edit_text(
            f"{parent_label}\n\nAniq turini tanlang:",
            reply_markup=kb,
        )
    await query.answer()


@prod_router.callback_query(F.data.startswith("prod:sp:"))
async def prod_subcategory_page(query: CallbackQuery, state: FSMContext) -> None:
    parts = (query.data or "").split(":")
    if len(parts) < 4:
        await query.answer()
        return
    parent_id, page_s = parts[2], parts[3]
    page = int(page_s)
    pending_id = await _pending_id_from_state(state)
    if not pending_id:
        await query.answer("Qoralama topilmadi", show_alert=True)
        return
    async with AsyncSessionFactory() as session:
        kb, _ = await _subcategory_keyboard(session, pending_id, parent_id, page=page)
    if query.message:
        await query.message.edit_reply_markup(reply_markup=kb)
    await query.answer()


@prod_router.callback_query(F.data.startswith("prod:set:"))
async def prod_set_category(query: CallbackQuery, state: FSMContext) -> None:
    parts = (query.data or "").split(":", 2)
    if len(parts) < 3:
        await query.answer()
        return
    cat_id_s = parts[2]
    pending_id = await _pending_id_from_state(state)
    if not pending_id:
        await query.answer("Qoralama topilmadi", show_alert=True)
        return
    if not query.message:
        await query.answer()
        return
    shop_id = await _resolve_shop_id(state, int(query.message.chat.id))
    if not shop_id:
        await query.answer("Chat do'konga ulanmagan", show_alert=True)
        return
    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        row = await repo.get_pending_product(uuid.UUID(pending_id), shop_id=shop_id)
        if not row:
            await query.answer("Qoralama topilmadi")
            return
        attrs = dict(row.vision_attributes or {})
        attrs["category_id"] = cat_id_s
        from app.infrastructure.db.models import CategoryModel

        cat_row = await session.get(CategoryModel, uuid.UUID(cat_id_s))
        cat_name = cat_row.name if cat_row else None
        parent_name = None
        if cat_row and cat_row.parent_id:
            parent_row = await session.get(CategoryModel, cat_row.parent_id)
            parent_name = parent_row.name if parent_row else None
        if cat_name:
            attrs["category_label"] = f"{parent_name} › {cat_name}" if parent_name else cat_name
        attrs = await _apply_category_size_presets(session, attrs, reset_sizes=True)
        row = await repo.update_pending_product(row, vision_attributes=attrs)
        await session.commit()
    if query.message:
        await query.message.edit_text(
            _format_preview(attrs, category_name=attrs.get("category_label")),
            reply_markup=_product_keyboard(pending_id, has_category=True),
        )
    await query.answer("Kategoriya saqlandi")


@prod_router.callback_query(F.data.startswith("prod:sizes:"))
async def prod_pick_sizes(query: CallbackQuery, state: FSMContext) -> None:
    pending_id = (query.data or "").split(":", 2)[2]
    if not query.message:
        await query.answer()
        return
    shop_id = await _resolve_shop_id(state, int(query.message.chat.id))
    if not shop_id:
        await query.answer("Chat do'konga ulanmagan", show_alert=True)
        return
    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        row = await repo.get_pending_product(uuid.UUID(pending_id), shop_id=shop_id)
        if not row:
            await query.answer("Qoralama topilmadi")
            return
        attrs = dict(row.vision_attributes or {})
        presets = await size_presets_for_attrs(session, attrs)
        group = await size_group_for_attrs(session, attrs)
        draft = get_variant_draft(attrs)
        size_title = size_group_label(group)
    await query.message.edit_text(
        f"{size_title} — bir nechta tanlash mumkin:",
        reply_markup=_size_keyboard(pending_id, draft, presets),
    )
    await query.answer()


@prod_router.callback_query(F.data.startswith("prod:sz:"))
async def prod_toggle_size(query: CallbackQuery, state: FSMContext) -> None:
    parts = (query.data or "").split(":")
    if len(parts) < 4:
        await query.answer()
        return
    pending_id, size = parts[2], parts[3]
    if not query.message:
        await query.answer()
        return
    shop_id = await _resolve_shop_id(state, int(query.message.chat.id))
    if not shop_id:
        await query.answer("Chat do'konga ulanmagan", show_alert=True)
        return
    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        row = await repo.get_pending_product(uuid.UUID(pending_id), shop_id=shop_id)
        if not row:
            await query.answer("Qoralama topilmadi")
            return
        attrs = dict(row.vision_attributes or {})
        draft = get_variant_draft(attrs)
        draft = toggle_size(draft, size)
        draft = apply_all_sizes_to_colors(draft)
        attrs = set_variant_draft(attrs, draft)
        await repo.update_pending_product(row, vision_attributes=attrs)
        await session.commit()
        presets = await size_presets_for_attrs(session, attrs)
    await query.message.edit_reply_markup(reply_markup=_size_keyboard(pending_id, draft, presets))
    await query.answer(f"Razmer: {size}")


@prod_router.callback_query(F.data.startswith("prod:addcolor:"))
async def prod_add_color_start(query: CallbackQuery, state: FSMContext) -> None:
    pending_id = (query.data or "").split(":", 2)[2]
    await state.set_state(MerchantBotStates.product_add_color_name)
    await state.update_data(edit_pending_id=pending_id)
    if query.message:
        await query.message.answer(
            "Yangi rang nomini kiriting (masalan: Qora, Oq, Jigarrang).\n"
            "Keyin shu rang uchun rasm yuboring — bir nechta rasm ham bo'ladi."
        )
    await query.answer()


@prod_router.message(MerchantBotStates.product_add_color_name, F.text)
async def prod_add_color_name(message: Message, state: FSMContext) -> None:
    name = (message.text or "").strip()
    if len(name) < 2:
        await message.answer("Rang nomi kamida 2 belgi.")
        return
    if "," in name or ";" in name:
        await message.answer(
            "Bitta rang kiriting (vergul bilan emas). "
            "Har bir rang uchun «+ Rang/rasm» tugmasidan foydalaning."
        )
        return
    data = await state.get_data()
    pending_id = data.get("edit_pending_id")
    if not pending_id:
        await state.set_state(MerchantBotStates.ready)
        return
    await state.update_data(new_color_name=name)
    await state.set_state(MerchantBotStates.product_add_color_photo)
    await message.answer(f"'{name}' uchun rasm yuboring (yana rasm yuborish mumkin, /done tugatadi).")


@prod_router.message(MerchantBotStates.product_add_color_photo, F.photo)
async def prod_add_color_photo(message: Message, state: FSMContext, bot: Bot) -> None:
    if not message.photo:
        return
    data = await state.get_data()
    pending_id = data.get("edit_pending_id")
    color_name = (data.get("new_color_name") or "").strip()
    if not pending_id or not color_name:
        await state.set_state(MerchantBotStates.ready)
        return
    photo = message.photo[-1]
    shop_id = await _resolve_shop_id(state, int(message.chat.id))
    if not shop_id:
        await message.answer("Chat do'konga ulanmagan.")
        await state.set_state(MerchantBotStates.ready)
        return
    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        row = await repo.get_pending_product(uuid.UUID(pending_id), shop_id=shop_id)
        if not row:
            await message.answer("Qoralama topilmadi.")
            await state.set_state(MerchantBotStates.ready)
            return
        attrs = dict(row.vision_attributes or {})
        draft = get_variant_draft(attrs)
        try:
            draft = add_color_photo(draft, color_name=color_name, telegram_file_id=photo.file_id)
        except ValueError:
            await message.answer("Avval rang nomini kiriting.")
            return
        attrs = set_variant_draft(attrs, draft)
        await repo.update_pending_product(row, vision_attributes=attrs)
        await session.commit()
    images_line, _ = draft_summary(draft)
    await message.answer(f"Rasm qo'shildi ({images_line}). Yana rasm yuboring yoki /done bosing.")


@prod_router.message(MerchantBotStates.product_add_color_photo, F.text)
async def prod_add_color_done(message: Message, state: FSMContext) -> None:
    text = (message.text or "").strip().lower()
    if text not in {"/done", "tayyor", "bitdi", "tugatish", "✅ tayyor"}:
        await message.answer(
            "Yana rasm yuboring yoki «✅ Tayyor» deb yozing (yoki /done)."
        )
        return
    data = await state.get_data()
    pending_id = data.get("edit_pending_id")
    if not pending_id:
        await state.set_state(MerchantBotStates.ready)
        return
    shop_id = await _resolve_shop_id(state, int(message.chat.id))
    if not shop_id:
        await state.set_state(MerchantBotStates.ready)
        return
    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        row = await repo.get_pending_product(uuid.UUID(pending_id), shop_id=shop_id)
        if not row:
            await message.answer("Qoralama topilmadi.")
            await state.set_state(MerchantBotStates.ready)
            return
        attrs = row.vision_attributes or {}
    await state.set_state(MerchantBotStates.ready)
    await message.answer(
        _format_preview(attrs, category_name=attrs.get("category_label")),
        reply_markup=_product_keyboard(pending_id, has_category=bool(attrs.get("category_id"))),
    )


@prod_router.callback_query(F.data.startswith("prod:back:"))
async def prod_back_preview(query: CallbackQuery, state: FSMContext) -> None:
    pending_id = (query.data or "").split(":", 2)[2]
    if not query.message:
        await query.answer()
        return
    shop_id = await _resolve_shop_id(state, int(query.message.chat.id))
    if not shop_id:
        await query.answer("Chat do'konga ulanmagan", show_alert=True)
        return
    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        row = await repo.get_pending_product(uuid.UUID(pending_id), shop_id=shop_id)
        if not row:
            await query.answer()
            return
        attrs = row.vision_attributes or {}
    if query.message:
        await query.message.edit_text(
            _format_preview(attrs, category_name=attrs.get("category_label")),
            reply_markup=_product_keyboard(pending_id, has_category=bool(attrs.get("category_id"))),
        )
    await query.answer()


@prod_router.callback_query(F.data.startswith("prod:stock:"))
async def prod_edit_stock(query: CallbackQuery, state: FSMContext) -> None:
    pending_id = (query.data or "").split(":", 2)[2]
    await state.set_state(MerchantBotStates.product_edit_stock)
    await state.update_data(edit_pending_id=pending_id)
    if query.message:
        await query.message.answer(
            "Omborda nechta dona bor? (masalan: 12)\n"
            "Tugab qolsa keyin «Ombor yangilash» orqali qo'shasiz."
        )
    await query.answer()


@prod_router.message(MerchantBotStates.product_edit_stock, F.text)
async def prod_save_stock(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    pending_id = data.get("edit_pending_id")
    if not pending_id:
        await state.set_state(MerchantBotStates.ready)
        return
    digits = "".join(c for c in (message.text or "") if c.isdigit())
    if not digits:
        await message.answer("Faqat raqam kiriting (masalan: 10).")
        return
    stock = int(digits)
    if stock < 1 or stock > 99_999:
        await message.answer("1 dan 99 999 gacha kiriting.")
        return
    shop_id = await _resolve_shop_id(state, int(message.chat.id))
    if not shop_id:
        await message.answer("Chat do'konga ulanmagan. /start bilan qayta ulang.")
        await state.set_state(MerchantBotStates.ready)
        return
    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        row = await repo.get_pending_product(uuid.UUID(pending_id), shop_id=shop_id)
        if not row:
            await message.answer("Qoralama topilmadi.")
            await state.set_state(MerchantBotStates.ready)
            return
        attrs = dict(row.vision_attributes or {})
        draft = set_fallback_stock(get_variant_draft(attrs), stock)
        attrs = set_variant_draft(attrs, draft)
        await repo.update_pending_product(row, vision_attributes=attrs)
        await session.commit()
    await state.set_state(MerchantBotStates.ready)
    await message.answer(
        _format_preview(attrs, category_name=attrs.get("category_label")),
        reply_markup=_product_keyboard(pending_id, has_category=bool(attrs.get("category_id"))),
    )


@prod_router.callback_query(F.data.startswith("prod:price:"))
async def prod_edit_price(query: CallbackQuery, state: FSMContext) -> None:
    pending_id = (query.data or "").split(":", 2)[2]
    await state.set_state(MerchantBotStates.product_edit_price)
    await state.update_data(edit_pending_id=pending_id)
    if query.message:
        await query.message.answer("Yangi narx (so'm, faqat raqam):")
    await query.answer()


@prod_router.callback_query(F.data.startswith("prod:ht:"))
async def prod_edit_hashtags(query: CallbackQuery, state: FSMContext) -> None:
    pending_id = (query.data or "").split(":", 2)[2]
    await state.set_state(MerchantBotStates.product_edit_hashtags)
    await state.update_data(edit_pending_id=pending_id)
    if query.message:
        await query.message.answer(
            "Hashtaglar kiriting (masalan: #tufli #ayollar #qora yoki: tufli, ayollar, qora).\n"
            "Bo'sh yuborsangiz — kategoriya va nomdan avtomatik tuziladi."
        )
    await query.answer()


@prod_router.message(MerchantBotStates.product_edit_hashtags, F.text)
async def prod_save_hashtags(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    pending_id = data.get("edit_pending_id")
    if not pending_id:
        await state.set_state(MerchantBotStates.ready)
        return
    shop_id = await _resolve_shop_id(state, int(message.chat.id))
    if not shop_id:
        await message.answer("Chat do'konga ulanmagan. /start bilan qayta ulang.")
        await state.set_state(MerchantBotStates.ready)
        return
    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        row = await repo.get_pending_product(uuid.UUID(pending_id), shop_id=shop_id)
        if not row:
            await message.answer("Qoralama topilmadi.")
            await state.set_state(MerchantBotStates.ready)
            return
        attrs = dict(row.vision_attributes or {})
        raw = (message.text or "").strip()
        if raw in {"", "-", "0"}:
            attrs["hashtags"] = suggest_hashtags_from_attrs(attrs)
        else:
            parsed = parse_hashtags_from_text(raw)
            attrs["hashtags"] = parsed or suggest_hashtags_from_attrs(attrs)
        await repo.update_pending_product(row, vision_attributes=attrs)
        await session.commit()
    await state.set_state(MerchantBotStates.ready)
    await message.answer(
        _format_preview(attrs, category_name=attrs.get("category_label")),
        reply_markup=_product_keyboard(pending_id, has_category=bool(attrs.get("category_id"))),
    )


@prod_router.callback_query(F.data.startswith("prod:name:"))
async def prod_edit_name(query: CallbackQuery, state: FSMContext) -> None:
    pending_id = (query.data or "").split(":", 2)[2]
    await state.set_state(MerchantBotStates.product_edit_name)
    await state.update_data(edit_pending_id=pending_id)
    if query.message:
        await query.message.answer("Yangi mahsulot nomi:")
    await query.answer()


@prod_router.message(MerchantBotStates.product_edit_price, F.text)
async def prod_save_price(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    pending_id = data.get("edit_pending_id")
    if not pending_id:
        await state.set_state(MerchantBotStates.ready)
        return
    digits = "".join(c for c in (message.text or "") if c.isdigit())
    if not digits:
        await message.answer("Faqat raqam kiriting.")
        return
    price = int(digits)
    if price < 100:
        await message.answer("Narx kamida 100 so'm bo'lishi kerak.")
        return
    shop_id = await _resolve_shop_id(state, int(message.chat.id))
    if not shop_id:
        await message.answer("Chat do'konga ulanmagan. /start bilan qayta ulang.")
        await state.set_state(MerchantBotStates.ready)
        return
    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        row = await repo.get_pending_product(uuid.UUID(pending_id), shop_id=shop_id)
        if not row:
            await message.answer("Qoralama topilmadi.")
            await state.set_state(MerchantBotStates.ready)
            return
        attrs = dict(row.vision_attributes or {})
        attrs["price_uzs"] = price
        await repo.update_pending_product(row, vision_attributes=attrs)
        await session.commit()
    await state.set_state(MerchantBotStates.ready)
    price_fmt = f"{price:,}".replace(",", " ")
    await message.answer(
        f"✅ Narx saqlandi: {price_fmt} so'm\n\n"
        + _format_preview(attrs, category_name=attrs.get("category_label")),
        reply_markup=_product_keyboard(pending_id, has_category=bool(attrs.get("category_id"))),
    )


@prod_router.message(MerchantBotStates.product_edit_name, F.text)
async def prod_save_name(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    pending_id = data.get("edit_pending_id")
    name = (message.text or "").strip()
    if not pending_id or len(name) < 2:
        await message.answer("Nom kamida 2 belgi.")
        return
    shop_id = await _resolve_shop_id(state, int(message.chat.id))
    if not shop_id:
        await message.answer("Chat do'konga ulanmagan. /start bilan qayta ulang.")
        await state.set_state(MerchantBotStates.ready)
        return
    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        row = await repo.get_pending_product(uuid.UUID(pending_id), shop_id=shop_id)
        if not row:
            await message.answer("Qoralama topilmadi.")
            await state.set_state(MerchantBotStates.ready)
            return
        attrs = dict(row.vision_attributes or {})
        attrs["product_name"] = name
        await repo.update_pending_product(row, vision_attributes=attrs)
        await session.commit()
    await state.set_state(MerchantBotStates.ready)
    await message.answer(
        _format_preview(attrs, category_name=attrs.get("category_label")),
        reply_markup=_product_keyboard(pending_id, has_category=bool(attrs.get("category_id"))),
    )


@prod_router.callback_query(F.data.startswith("prod:cancel:"))
async def prod_cancel(query: CallbackQuery, state: FSMContext) -> None:
    pending_id = (query.data or "").split(":", 2)[2]
    if not query.message:
        await query.answer()
        return
    shop_id = await _resolve_shop_id(state, int(query.message.chat.id))
    if not shop_id:
        await query.answer("Chat do'konga ulanmagan", show_alert=True)
        return
    async with AsyncSessionFactory() as session:
        settings = get_settings()
        notifier = TelegramNotifierGateway(settings.telegram_bot_token) if settings.telegram_bot_token else None
        svc = MerchantProductService(session, notifier=notifier)
        try:
            from app.application.merchant.schemas import RejectPendingProductRequest

            await svc.reject_pending_product(
                uuid.UUID(pending_id),
                shop_id=shop_id,
                payload=RejectPendingProductRequest(reason="merchant_cancelled"),
            )
        except Exception:
            logger.warning("prod_cancel_reject_failed pending_id=%s", pending_id, exc_info=True)
    if query.message:
        await query.message.edit_text("Mahsulot bekor qilindi.")
    await query.answer()


async def _resolve_pending_category_uuid(session, attrs: dict) -> uuid.UUID | None:
    enriched = await enrich_attrs_with_category(session, attrs)
    cat_id = enriched.get("category_id")
    if cat_id:
        try:
            return uuid.UUID(str(cat_id))
        except ValueError:
            pass
    matched = await resolve_category_from_attrs(session, attrs)
    return matched.id if matched else None


@prod_router.callback_query(F.data.startswith("prod:pub:"))
async def prod_publish(query: CallbackQuery, state: FSMContext) -> None:
    pending_id = (query.data or "").split(":", 2)[2]
    if not query.message:
        await query.answer()
        return
    shop_id = await _resolve_shop_id(state, int(query.message.chat.id))
    if not shop_id:
        await query.answer("Chat do'konga ulanmagan", show_alert=True)
        return
    await query.answer("Yuklanmoqda…")
    status_msg = None
    try:
        status_msg = await query.message.answer("⏳ Mahsulot yuklanmoqda…")
    except Exception:
        pass
    result = None
    attrs: dict = {}
    price = 0
    try:
        async with asyncio.timeout(_PUBLISH_TIMEOUT_SEC):
            async with AsyncSessionFactory() as session:
                repo = MarketplaceRepository(session)
                row = await repo.get_pending_product(uuid.UUID(pending_id), shop_id=shop_id)
                if not row:
                    await query.message.answer("Qoralama topilmadi.")
                    return
                if row.status == "published" and row.published_product_id:
                    attrs = row.vision_attributes or {}
                    name = str(attrs.get("product_name") or "Mahsulot")
                    price_raw = attrs.get("price_uzs")
                    price_line = f"{int(price_raw):,} so'm".replace(",", " ") if price_raw else "—"
                    await query.message.edit_text(
                        f"✅ Mahsulot allaqachon yuklangan: {name}\nNarx: {price_line}",
                        reply_markup=None,
                    )
                    return
                attrs = dict(row.vision_attributes or {})
                category_uuid = await _resolve_pending_category_uuid(session, attrs)
                if category_uuid is None:
                    await query.message.answer("Avval kategoriya tanlang.")
                    return
                if not attrs.get("category_id"):
                    attrs = await enrich_attrs_with_category(session, attrs)
                    await repo.update_pending_product(row, vision_attributes=attrs)
                    await session.commit()
                price_raw = attrs.get("price_uzs")
                if not price_raw or int(price_raw) < 100:
                    await query.message.answer(
                        "Avval narx kiriting (kamida 100 so'm).\n«Narx» tugmasini bosing."
                    )
                    return
                price = int(price_raw)
                draft = get_variant_draft(attrs)
                if int(draft.get("fallback_stock") or 0) < 1:
                    await query.message.answer(
                        "Avval ombor miqdorini kiriting — «Ombor» tugmasini bosing."
                    )
                    return
                settings = get_settings()
                notifier = TelegramNotifierGateway(settings.telegram_bot_token) if settings.telegram_bot_token else None
                svc = MerchantProductService(session, notifier=notifier)
                try:
                    result = await svc.publish_pending_product(
                        uuid.UUID(pending_id),
                        shop_id=shop_id,
                        payload=PublishPendingProductRequest(
                            name=str(attrs.get("product_name") or "Mahsulot"),
                            price_uzs=price,
                            category_id=category_uuid,
                            description=attrs.get("description"),
                        ),
                    )
                except PublishPendingProductError as exc:
                    logger.warning("bot_publish_failed code=%s", exc.code)
                    friendly = {
                        "invalid_status": "Mahsulot allaqachon yuklangan.",
                        "image_failed": "Rasm saqlanmadi — qayta rasm yuboring.",
                        "invalid_price": "Narx noto'g'ri.",
                        "invalid_name": "Mahsulot nomi kerak.",
                        "stock_required": "Omborda nechta borligini kiriting (kamida 1 dona).",
                        "embedding_failed": "Qidiruv indeksi xatosi — qayta urinib ko'ring.",
                        "publish_failed": "Mahsulot saqlanmadi — qayta urinib ko'ring.",
                        "shop_not_verified": "Do'kon hali tasdiqlanmagan. Moderator arizangizni ko'rib chiqmoqda.",
                    }.get(exc.code, str(exc))
                    if exc.code == "ai_rejected":
                        friendly = str(exc)
                    await query.message.answer(f"Yuklashda xatolik: {friendly}")
                    return
    except TimeoutError:
        logger.warning("bot_publish_timeout", pending_id=pending_id)
        await query.message.answer("Yuklash vaqti tugadi. Bir ozdan keyin qayta «Yuklash» bosing.")
        return
    except Exception:
        logger.exception("bot_publish_failed")
        await query.message.answer("Yuklashda xatolik. Qayta urinib ko'ring.")
        return

    if not result:
        return

    tags_line = format_hashtags_display(hashtags_for_publish(attrs))
    draft = get_variant_draft(attrs)
    stock_line = f"{int(draft.get('fallback_stock') or 0)} dona"
    success_text = (
        f"✅ Mahsulot yuklandi: {result.product_name}\n"
        f"Narx: {price:,} so'm\n"
        f"Ombor: {stock_line}\n"
        f"Hashtaglar: {tags_line}".replace(",", " ")
    )
    try:
        await query.message.edit_text(success_text, reply_markup=None)
    except Exception:
        await query.message.answer(success_text)
    if status_msg:
        try:
            await status_msg.delete()
        except Exception:
            pass

    try:
        from app.application.merchant.share_kit import build_product_share_message
        from app.application.merchant.product_hashtags import hashtags_for_publish as _ht

        async with AsyncSessionFactory() as session:
            shop = await MarketplaceRepository(session).get_shop(shop_id)
        if shop:
            share_text = build_product_share_message(
                shop,
                settings=get_settings(),
                product_name=result.product_name,
                price_uzs=price,
                hashtags=_ht(attrs),
            )
            await query.message.answer(
                "📣 Mijozlarga ulashish uchun tayyor xabar:\n\n" + share_text
            )
    except Exception:
        logger.warning("product_share_message_failed", exc_info=True)


_STOCK_PAGE_SIZE = 6


def _stock_product_label(name: str, stock: int, *, available: bool) -> str:
    prefix = "" if available else "⛔ "
    short = name.strip()[:22] + ("…" if len(name.strip()) > 22 else "")
    return f"{prefix}{short} ({stock})"


def _stock_list_keyboard(products: list, page: int) -> InlineKeyboardMarkup:
    start = page * _STOCK_PAGE_SIZE
    chunk = list(products[start : start + _STOCK_PAGE_SIZE])
    rows: list[list[InlineKeyboardButton]] = []
    for product in chunk:
        label = _stock_product_label(
            product.name,
            int(product.stock_count or 0),
            available=bool(product.is_available),
        )
        rows.append(
            [InlineKeyboardButton(text=label, callback_data=_cb(f"stk:sel:{product.id}"))]
        )
    nav: list[InlineKeyboardButton] = []
    if page > 0:
        nav.append(InlineKeyboardButton(text="«", callback_data=f"stk:page:{page - 1}"))
    if start + _STOCK_PAGE_SIZE < len(products):
        nav.append(InlineKeyboardButton(text="»", callback_data=f"stk:page:{page + 1}"))
    if nav:
        rows.append(nav)
    rows.append([InlineKeyboardButton(text="Bekor", callback_data="stk:cancel")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


async def _send_stock_product_list(message: Message, state: FSMContext, *, page: int = 0) -> None:
    shop_id = await _resolve_shop_id(state, int(message.chat.id))
    if not shop_id:
        await message.answer("Chat do'konga ulanmagan. /start bilan qayta ulang.")
        return
    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        products = list(
            await repo.list_shop_products(shop_id, limit=80, offset=0, include_unavailable=True)
        )
    if not products:
        await message.answer("Hali mahsulot yo'q. Avval rasm yuborib yuklang.")
        return
    page = max(0, page)
    max_page = max(0, (len(products) - 1) // _STOCK_PAGE_SIZE)
    page = min(page, max_page)
    await message.answer(
        "Qaysi mahsulot omborini yangilaysiz?\n"
        "Qavs ichida — hozirgi dona. ⛔ — tugagan.",
        reply_markup=_stock_list_keyboard(products, page),
    )


@prod_router.message(MerchantBotStates.ready, F.text == "Ombor yangilash")
async def stock_menu(message: Message, state: FSMContext) -> None:
    await _send_stock_product_list(message, state, page=0)


@prod_router.callback_query(F.data.startswith("stk:page:"))
async def stock_list_page(query: CallbackQuery, state: FSMContext) -> None:
    if not query.message:
        await query.answer()
        return
    page = int((query.data or "").split(":", 2)[2])
    shop_id = await _resolve_shop_id(state, int(query.message.chat.id))
    if not shop_id:
        await query.answer("Chat ulanmagan", show_alert=True)
        return
    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        products = list(
            await repo.list_shop_products(shop_id, limit=80, offset=0, include_unavailable=True)
        )
    if not products:
        await query.message.edit_text("Mahsulot topilmadi.")
        await query.answer()
        return
    max_page = max(0, (len(products) - 1) // _STOCK_PAGE_SIZE)
    page = max(0, min(page, max_page))
    await query.message.edit_text(
        "Qaysi mahsulot omborini yangilaysiz?\n"
        "Qavs ichida — hozirgi dona. ⛔ — tugagan.",
        reply_markup=_stock_list_keyboard(products, page),
    )
    await query.answer()


@prod_router.callback_query(F.data == "stk:cancel")
async def stock_cancel(query: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(MerchantBotStates.ready)
    if query.message:
        await query.message.edit_text("Bekor qilindi.")
    await query.answer()


@prod_router.callback_query(F.data.startswith("stk:sel:"))
async def stock_pick_product(query: CallbackQuery, state: FSMContext) -> None:
    if not query.message:
        await query.answer()
        return
    product_id = (query.data or "").split(":", 2)[2]
    shop_id = await _resolve_shop_id(state, int(query.message.chat.id))
    if not shop_id:
        await query.answer("Chat ulanmagan", show_alert=True)
        return
    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        product = await repo.get_shop_product(shop_id, uuid.UUID(product_id))
    if not product:
        await query.answer("Mahsulot topilmadi", show_alert=True)
        return
    await state.set_state(MerchantBotStates.stock_set_quantity)
    await state.update_data(stock_product_id=product_id)
    stock = int(product.stock_count or 0)
    status = "mavjud" if product.is_available else "tugagan"
    await query.message.answer(
        f"«{product.name}»\n"
        f"Hozir: {stock} dona ({status})\n\n"
        "Yangi umumiy miqdorni kiriting (masalan: 15).\n"
        "Yangi partiya kelganda shu raqamni yozasiz."
    )
    await query.answer()


@prod_router.message(MerchantBotStates.stock_set_quantity, F.text)
async def stock_save_quantity(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    product_id_raw = data.get("stock_product_id")
    if not product_id_raw:
        await state.set_state(MerchantBotStates.ready)
        return
    digits = "".join(c for c in (message.text or "") if c.isdigit())
    if not digits:
        await message.answer("Faqat raqam kiriting.")
        return
    stock = int(digits)
    if stock < 0 or stock > 99_999:
        await message.answer("0 dan 99 999 gacha kiriting.")
        return
    shop_id = await _resolve_shop_id(state, int(message.chat.id))
    if not shop_id:
        await message.answer("Chat do'konga ulanmagan. /start bilan qayta ulang.")
        await state.set_state(MerchantBotStates.ready)
        return
    settings = get_settings()
    notifier = TelegramNotifierGateway(settings.telegram_bot_token) if settings.telegram_bot_token else None
    async with AsyncSessionFactory() as session:
        svc = MerchantProductService(session, notifier=notifier)
        try:
            name, total = await svc.update_warehouse_stock(
                uuid.UUID(str(product_id_raw)),
                shop_id=shop_id,
                stock=stock,
            )
        except PublishPendingProductError as exc:
            await message.answer(str(exc))
            await state.set_state(MerchantBotStates.ready)
            return
        except Exception:
            logger.exception("stock_update_failed")
            await message.answer("Saqlashda xatolik. Qayta urinib ko'ring.")
            await state.set_state(MerchantBotStates.ready)
            return
    await state.set_state(MerchantBotStates.ready)
    if total > 0:
        await message.answer(f"✅ «{name}» — ombor yangilandi: {total} dona")
    else:
        await message.answer(f"«{name}» — ombor 0. Mahsulot sotuvdan olib turildi.")
