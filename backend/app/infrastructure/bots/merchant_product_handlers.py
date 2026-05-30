from __future__ import annotations

import io
import logging
import uuid

from aiogram import Bot, F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message

from app.application.merchant.ai_inspector import AIInspectorService
from app.application.merchant.product_service import MerchantProductService, PublishPendingProductRequest
from app.application.merchant.product_vision_enrichment import enrich_product_from_vision
from app.core.config import get_settings
from app.infrastructure.ai_clients.gemini import GeminiClient
from app.infrastructure.bots.merchant_states import MerchantBotStates
from app.infrastructure.db.session import AsyncSessionFactory
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository

logger = logging.getLogger(__name__)
prod_router = Router(name="merchant_product")


def _format_preview(attrs: dict, *, category_name: str | None = None) -> str:
    name = attrs.get("product_name") or attrs.get("category") or "Mahsulot"
    price = attrs.get("price_uzs")
    price_line = f"{int(price):,} so'm".replace(",", " ") if price else "narxni kiriting"
    cat_line = category_name or attrs.get("category_hint") or attrs.get("category") or "—"
    color = attrs.get("color") or "—"
    return (
        f"Mahsulot: {name}\n"
        f"Kategoriya: {cat_line}\n"
        f"Narx: {price_line}\n"
        f"Rang: {color}\n\n"
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
            InlineKeyboardButton(text="Yuklash", callback_data=f"prod:pub:{pending_id}"),
        ],
        [InlineKeyboardButton(text="Bekor", callback_data=f"prod:cancel:{pending_id}")],
    ]
    if not has_category:
        rows[0][0] = InlineKeyboardButton(text="Kategoriya tanlang", callback_data=f"prod:cat:{pending_id}")
    return InlineKeyboardMarkup(inline_keyboard=rows)


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
                    text=cat.name[:28],
                    callback_data=f"prod:setcat:{pending_id}:{cat.id}",
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


@prod_router.message(MerchantBotStates.ready, F.photo)
async def on_product_photo(message: Message, state: FSMContext, bot: Bot) -> None:
    if not message.photo or not message.from_user:
        return
    data = await state.get_data()
    shop_raw = data.get("shop_id")
    if not shop_raw:
        await message.answer("Avval /register yoki /start shop_<UUID> bilan ulanishni yakunlang.")
        return
    shop_id = uuid.UUID(str(shop_raw))
    photo = message.photo[-1]
    buf = io.BytesIO()
    try:
        await bot.download(photo, destination=buf)
    except Exception:
        await message.answer("Rasmni yuklab bo'lmadi.")
        return
    raw = buf.getvalue()
    status_msg = await message.answer("AI mahsulotni tahlil qilmoqda…")

    async with AsyncSessionFactory() as session:
        inspector = AIInspectorService(session)
        moderation = await inspector.moderate_image(raw)
        if not moderation.allowed:
            await session.commit()
            await status_msg.edit_text(f"Rasm rad etildi: {moderation.reason}")
            return
        try:
            attrs = await GeminiClient().extract_attributes(raw)
        except Exception:
            logger.exception("gemini_vision_failed")
            await status_msg.edit_text("Rasm tahlilida xatolik.")
            return
        attrs = await enrich_product_from_vision(attrs)
        if moderation.category:
            attrs.setdefault("category_hint", moderation.category)
        attrs["moderation"] = {"allowed": True, "reason": moderation.reason, "flags": moderation.flags}

        repo = MarketplaceRepository(session)
        row = await repo.create_merchant_pending_product(
            shop_id=shop_id,
            vision_attributes=attrs,
            telegram_user_id=int(message.from_user.id),
            telegram_chat_id=int(message.chat.id),
            telegram_file_id=photo.file_id,
        )
        await session.commit()

    cat_name = None
    await state.update_data(active_pending_id=str(row.id))
    await status_msg.edit_text(
        _format_preview(attrs, category_name=cat_name),
        reply_markup=_product_keyboard(str(row.id), has_category=bool(attrs.get("category_id"))),
    )


@prod_router.callback_query(F.data.startswith("prod:catpage:"))
async def prod_cat_page(query: CallbackQuery) -> None:
    parts = (query.data or "").split(":")
    if len(parts) < 4:
        await query.answer()
        return
    pending_id, page_s = parts[2], parts[3]
    page = int(page_s)
    async with AsyncSessionFactory() as session:
        kb = await _category_keyboard(session, pending_id, page=page)
    if query.message:
        await query.message.edit_reply_markup(reply_markup=kb)
    await query.answer()


@prod_router.callback_query(F.data.startswith("prod:cat:"))
async def prod_pick_category(query: CallbackQuery) -> None:
    pending_id = (query.data or "").split(":", 2)[2]
    async with AsyncSessionFactory() as session:
        kb = await _category_keyboard(session, pending_id, page=0)
    if query.message:
        await query.message.edit_text("Kategoriyani tanlang:", reply_markup=kb)
    await query.answer()


@prod_router.callback_query(F.data.startswith("prod:setcat:"))
async def prod_set_category(query: CallbackQuery, state: FSMContext) -> None:
    parts = (query.data or "").split(":")
    if len(parts) < 4:
        await query.answer()
        return
    pending_id, cat_id_s = parts[2], parts[3]
    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        data = await state.get_data()
        shop_id = uuid.UUID(str(data["shop_id"]))
        row = await repo.get_pending_product(uuid.UUID(pending_id), shop_id=shop_id)
        if not row:
            await query.answer("Qoralama topilmadi")
            return
        attrs = dict(row.vision_attributes or {})
        attrs["category_id"] = cat_id_s
        from app.infrastructure.db.models import CategoryModel

        cat_row = await session.get(CategoryModel, uuid.UUID(cat_id_s))
        cat_name = cat_row.name if cat_row else None
        if cat_name:
            attrs["category_label"] = cat_name
        row = await repo.update_pending_product(row, vision_attributes=attrs)
        await session.commit()
    if query.message:
        await query.message.edit_text(
            _format_preview(attrs, category_name=attrs.get("category_label")),
            reply_markup=_product_keyboard(pending_id, has_category=True),
        )
    await query.answer("Kategoriya saqlandi")


@prod_router.callback_query(F.data.startswith("prod:back:"))
async def prod_back_preview(query: CallbackQuery, state: FSMContext) -> None:
    pending_id = (query.data or "").split(":", 2)[2]
    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        data = await state.get_data()
        row = await repo.get_pending_product(uuid.UUID(pending_id), shop_id=uuid.UUID(str(data["shop_id"])))
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


@prod_router.callback_query(F.data.startswith("prod:price:"))
async def prod_edit_price(query: CallbackQuery, state: FSMContext) -> None:
    pending_id = (query.data or "").split(":", 2)[2]
    await state.set_state(MerchantBotStates.product_edit_price)
    await state.update_data(edit_pending_id=pending_id)
    if query.message:
        await query.message.answer("Yangi narx (so'm, faqat raqam):")
    await query.answer()


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
    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        row = await repo.get_pending_product(
            uuid.UUID(pending_id), shop_id=uuid.UUID(str(data["shop_id"]))
        )
        if not row:
            await message.answer("Qoralama topilmadi.")
            await state.set_state(MerchantBotStates.ready)
            return
        attrs = dict(row.vision_attributes or {})
        attrs["price_uzs"] = price
        await repo.update_pending_product(row, vision_attributes=attrs)
        await session.commit()
    await state.set_state(MerchantBotStates.ready)
    await message.answer(
        _format_preview(attrs, category_name=attrs.get("category_label")),
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
    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        row = await repo.get_pending_product(
            uuid.UUID(pending_id), shop_id=uuid.UUID(str(data["shop_id"]))
        )
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
    async with AsyncSessionFactory() as session:
        settings = get_settings()
        notifier = TelegramNotifierGateway(settings.telegram_bot_token) if settings.telegram_bot_token else None
        svc = MerchantProductService(session, notifier=notifier)
        data = await state.get_data()
        try:
            from app.application.merchant.schemas import RejectPendingProductRequest

            await svc.reject_pending_product(
                uuid.UUID(pending_id),
                shop_id=uuid.UUID(str(data["shop_id"])),
                payload=RejectPendingProductRequest(reason="merchant_cancelled"),
            )
        except Exception:
            pass
    if query.message:
        await query.message.edit_text("Mahsulot bekor qilindi.")
    await query.answer()


@prod_router.callback_query(F.data.startswith("prod:pub:"))
async def prod_publish(query: CallbackQuery, state: FSMContext) -> None:
    pending_id = (query.data or "").split(":", 2)[2]
    data = await state.get_data()
    shop_id = uuid.UUID(str(data["shop_id"]))
    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        row = await repo.get_pending_product(uuid.UUID(pending_id), shop_id=shop_id)
        if not row:
            await query.answer("Topilmadi")
            return
        attrs = row.vision_attributes or {}
        cat_id = attrs.get("category_id")
        category_uuid = uuid.UUID(str(cat_id)) if cat_id else None
        if category_uuid is None:
            hint = str(attrs.get("category_hint") or attrs.get("category") or "")
            matched = await repo.get_category_by_slug_or_name(hint)
            category_uuid = matched.id if matched else None
        if category_uuid is None:
            await query.answer("Avval kategoriya tanlang", show_alert=True)
            return
        price = attrs.get("price_uzs")
        if not price:
            await query.answer("Avval narx kiriting", show_alert=True)
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
                    price_uzs=int(price),
                    category_id=category_uuid,
                    description=attrs.get("description"),
                ),
            )
        except Exception as exc:
            logger.exception("bot_publish_failed")
            if query.message:
                await query.message.answer(f"Yuklashda xatolik: {exc}")
            await query.answer()
            return
    if query.message:
        await query.message.edit_text(
            f"Mahsulot yuklandi: {result.product_name}\n"
            f"Narx: {int(price):,} so'm".replace(",", " ")
        )
    await query.answer("Yuklandi")
