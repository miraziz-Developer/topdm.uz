from __future__ import annotations

import logging
import uuid

from aiogram import F, Router
from aiogram.filters import Command, CommandObject
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message, ReplyKeyboardRemove

from app.application.merchant.registration import (
    MARKET_ZONE_OPTIONS,
    SHOP_TYPE_OPTIONS,
    MerchantRegistrationDraft,
    MerchantRegistrationService,
    normalize_uz_phone,
    parse_shop_type_label,
)
from app.infrastructure.bots.merchant_bot_ui import (
    contact_keyboard,
    location_keyboard,
    market_zone_keyboard,
    merchant_menu_keyboard,
    pending_approval_keyboard,
    shop_type_keyboard,
    start_inline_keyboard,
)
from app.application.map.geo_anchors import (
    ABU_SAXIY_NODE_LAT,
    ABU_SAXIY_NODE_LNG,
    IPPODROM_CENTER_LAT,
    IPPODROM_CENTER_LNG,
)
from app.infrastructure.bots.merchant_states import MerchantBotStates
from app.infrastructure.db.session import AsyncSessionFactory

reg_router = Router(name="merchant_registration")
logger = logging.getLogger(__name__)

_LOCATION_STEP_HINT = (
    "7/9 — Do'kon joylashuvi\n\n"
    "📱 Telefon (Telegram mobil): pastdagi «Joylashuvni yuborish» → «Share».\n"
    "💻 Kompyuter (Telegram Desktop): 📎 (Attach) → Location → nuqtani yuboring.\n"
    "   (Desktopda pastdagi tugma ishlamasligi mumkin — bu Telegram cheklovi.)\n\n"
    "Yoki «Keyinroq (CRM xaritadan)» — ro'yxatdan o'tgach xaritada aniqlasiz."
)


def _default_coords_for_market(market_zone: str) -> tuple[float, float]:
    zone = (market_zone or "").strip().lower()
    if "abu" in zone or "saxiy" in zone:
        return ABU_SAXIY_NODE_LAT, ABU_SAXIY_NODE_LNG
    if "kozgalovka" in zone or "kozgalova" in zone:
        return 41.2365, 69.1810
    return IPPODROM_CENTER_LAT, IPPODROM_CENTER_LNG


async def _advance_after_location(message: Message, state: FSMContext, *, lat: float, lon: float, acc: float | None) -> None:
    await state.update_data(reg_lat=lat, reg_lon=lon, reg_loc_acc=acc)
    await state.set_state(MerchantBotStates.reg_storefront)
    await message.answer(
        "8/9 — Do'kon tashqi ko'rinishi (fasad) rasmini yuboring — majburiy:",
        reply_markup=ReplyKeyboardRemove(),
    )


def _cancel_hint() -> str:
    return "Bekor qilish uchun «Bekor qilish» yozing."


@reg_router.message(Command("register"))
@reg_router.message(F.text.casefold() == "ro'yxatdan o'tish")
@reg_router.message(F.text.casefold() == "royxatdan otish")
async def cmd_register(message: Message, state: FSMContext, command: CommandObject | None = None) -> None:
    if not message.from_user:
        return
    async with AsyncSessionFactory() as session:
        svc = MerchantRegistrationService(session)
        existing = await svc.chat_already_has_shop(int(message.chat.id))
    if existing:
        await state.set_state(MerchantBotStates.ready)
        await state.update_data(shop_id=str(existing.id))
        if existing.is_verified:
            await message.answer(
                f"Siz allaqachon ro'yxatdan o'tgansiz: {existing.name}",
                reply_markup=merchant_menu_keyboard(existing.id),
            )
        else:
            await message.answer(
                f"«{existing.name}» — ariza moderator ko'rib chiqmoqda.\n"
                "Tasdiqlangach Telegram orqali CRM login va parol yuboriladi (24 soat ichida).",
                reply_markup=pending_approval_keyboard(),
            )
        return

    await state.clear()
    raw_args = (command.args or "").strip() if command and command.args else ""
    fast = raw_args.casefold().startswith("tez")
    ref_code: str | None = None
    if fast:
        tail = raw_args[3:].strip().upper()
        if tail:
            ref_code = tail
    elif raw_args:
        ref_code = raw_args.upper()
    if ref_code:
        await state.update_data(reg_referral_code=ref_code)
    if fast:
        await state.update_data(reg_fast=True)
    await state.set_state(MerchantBotStates.reg_name)
    invite_hint = (
        f"\n\n🎁 Do'stingizning taklifi: {ref_code} — ro'yxatdan o'tgach ikkalangizga coin!"
        if ref_code
        else ""
    )
    steps = "3/3 tez ro'yxat" if fast else "9 qadam"
    await message.answer(
        f"Bozorliii — do'kon ro'yxatdan o'tish ({steps})\n\n"
        f"1 — Do'kon nomini yozing (masalan: Murod Fashion):{invite_hint}\n"
        + ("Tez rejim: joylashuv va rasm keyinroq CRM dan." if fast else ""),
        reply_markup=None,
    )


@reg_router.message(MerchantBotStates.reg_name, F.text)
async def reg_name(message: Message, state: FSMContext) -> None:
    name = (message.text or "").strip()
    if name.lower() in {"bekor qilish", "bekor"}:
        await state.clear()
        await message.answer("Ro'yxatdan o'tish bekor qilindi.")
        return
    if len(name) < 2:
        await message.answer("Nom juda qisqa. Qayta yozing.")
        return
    await state.update_data(reg_name=name)
    data = await state.get_data()
    if data.get("reg_fast"):
        await state.update_data(reg_shop_type="chakana", reg_shop_type_label="Chakana")
        await state.set_state(MerchantBotStates.reg_market)
        await message.answer("2/3 — Qaysi bozor?", reply_markup=market_zone_keyboard())
        return
    await state.set_state(MerchantBotStates.reg_shop_type)
    await message.answer(
        "2/9 — Do'kon turi:\n"
        "• Chakana — donalab sotadi\n"
        "• Optomchi — pachkada sotadi\n"
        "• Ikkalasi — ikkala formatda",
        reply_markup=shop_type_keyboard(),
    )


@reg_router.message(MerchantBotStates.reg_shop_type, F.text)
async def reg_shop_type(message: Message, state: FSMContext) -> None:
    label = (message.text or "").strip()
    if label.lower() in {"bekor qilish", "bekor"}:
        await state.clear()
        await message.answer("Bekor qilindi.")
        return
    shop_type = parse_shop_type_label(label)
    if not shop_type or label not in SHOP_TYPE_OPTIONS:
        await message.answer("Tugmani tanlang.", reply_markup=shop_type_keyboard())
        return
    await state.update_data(reg_shop_type=shop_type, reg_shop_type_label=label)
    await state.set_state(MerchantBotStates.reg_market)
    await message.answer(
        "3/9 — Qaysi bozor?\nTugmani tanlang:",
        reply_markup=market_zone_keyboard(),
    )


@reg_router.message(MerchantBotStates.reg_market, F.text)
async def reg_market(message: Message, state: FSMContext) -> None:
    zone = (message.text or "").strip()
    if zone.lower() in {"bekor qilish", "bekor"}:
        await state.clear()
        await message.answer("Bekor qilindi.")
        return
    if zone not in MARKET_ZONE_OPTIONS:
        await message.answer("Ro'yxatdan tugmani tanlang.", reply_markup=market_zone_keyboard())
        return
    await state.update_data(reg_market=zone)
    data = await state.get_data()
    if data.get("reg_fast"):
        lat, lon = _default_coords_for_market(zone)
        await state.update_data(
            reg_block="Aniqlanmadi",
            reg_stall="—",
            reg_location_comment="CRM xaritadan belgilanadi",
            reg_lat=lat,
            reg_lon=lon,
            reg_loc_acc=None,
        )
        await state.set_state(MerchantBotStates.reg_contact)
        await message.answer(
            "3/3 — Telefon raqamini yuboring.\n"
            "Blok/rasta va rasmni keyin CRM dan to'ldirasiz.",
            reply_markup=contact_keyboard(),
        )
        return
    await state.set_state(MerchantBotStates.reg_block)
    await message.answer(
        "4/9 — Blok / qator nomi (masalan: A blok, 2-qator):",
        reply_markup=None,
    )


@reg_router.message(MerchantBotStates.reg_block, F.text)
async def reg_block(message: Message, state: FSMContext) -> None:
    block = (message.text or "").strip()
    if block.lower() in {"bekor qilish", "bekor"}:
        await state.clear()
        await message.answer("Bekor qilindi.")
        return
    if len(block) < 1:
        await message.answer("Blok/qator kiriting.")
        return
    await state.update_data(reg_block=block)
    await state.set_state(MerchantBotStates.reg_stall)
    await message.answer("5/9 — Do'kon raqami (masalan: 12, 45-A):")


@reg_router.message(MerchantBotStates.reg_stall, F.text)
async def reg_stall(message: Message, state: FSMContext) -> None:
    stall = (message.text or "").strip()
    if stall.lower() in {"bekor qilish", "bekor"}:
        await state.clear()
        await message.answer("Bekor qilindi.")
        return
    await state.update_data(reg_stall=stall)
    data = await state.get_data()
    if data.get("reg_fast"):
        market = str(data.get("reg_market") or "")
        lat, lon = _default_coords_for_market(market)
        await state.update_data(
            reg_location_comment="CRM xaritadan belgilanadi",
            reg_lat=lat,
            reg_lon=lon,
            reg_loc_acc=None,
        )
        await state.set_state(MerchantBotStates.reg_contact)
        await message.answer(
            "Tez rejim — oxirgi qadam: telefon raqamini yuboring.\n"
            "Joylashuv va vitrina rasmini keyin CRM → Xarita dan to'ldirasiz.",
            reply_markup=contact_keyboard(),
        )
        return
    await state.set_state(MerchantBotStates.reg_location_comment)
    await message.answer(
        "6/9 — Joy topish uchun izoh (masalan: Eskalator yonida, ko'k eshik):"
    )


@reg_router.message(MerchantBotStates.reg_location_comment, F.text)
async def reg_location_comment(message: Message, state: FSMContext) -> None:
    comment = (message.text or "").strip()
    if comment.lower() in {"bekor qilish", "bekor"}:
        await state.clear()
        await message.answer("Bekor qilindi.")
        return
    await state.update_data(reg_location_comment=comment)
    await state.set_state(MerchantBotStates.reg_location)
    await message.answer(_LOCATION_STEP_HINT, reply_markup=location_keyboard())


@reg_router.message(MerchantBotStates.reg_location, F.location)
async def reg_location(message: Message, state: FSMContext) -> None:
    if not message.location:
        return
    await _advance_after_location(
        message,
        state,
        lat=message.location.latitude,
        lon=message.location.longitude,
        acc=message.location.horizontal_accuracy,
    )


@reg_router.message(MerchantBotStates.reg_location, F.photo)
async def reg_location_photo(message: Message, state: FSMContext) -> None:
    """Joylashuv o'rniga rasm yuborilsa — aniq yo'riqnoma."""
    await message.answer(
        "📍 Joylashuv kerak, rasm emas.\n\n"
        "📱 Mobil: pastdagi «Joylashuvni yuborish» tugmasini bosing\n"
        "💻 Desktop: 📎 (Attach) → Location\n\n"
        "Yoki «Keyinroq (CRM xaritadan)» tugmasini bosing — ro'yxatdan o'tgach xaritada belgilaysiz.",
        reply_markup=location_keyboard(),
    )


@reg_router.message(MerchantBotStates.reg_location, F.text)
async def reg_location_text(message: Message, state: FSMContext) -> None:
    text = (message.text or "").strip()
    lower = text.casefold()
    if lower in {"bekor qilish", "bekor"}:
        await state.clear()
        await message.answer("Bekor qilindi.", reply_markup=ReplyKeyboardRemove())
        return
    # "Keyinroq (CRM xaritadan)" tugmasi yoki shunga o'xshash
    _SKIP_KEYWORDS = {
        "keyinroq (crm xaritadan)",
        "keyinroq",
        "skip",
        "otkazib yuborish",
        "o'tkazib yuborish",
        "o'tkazib",
        "keyinroq (crm)",
    }
    if lower in _SKIP_KEYWORDS or lower.startswith("keyinroq"):
        data = await state.get_data()
        lat, lon = _default_coords_for_market(str(data.get("reg_market") or ""))
        await message.answer(
            "✅ Joylashuv vaqtincha bozor markaziga qo'yildi.\n"
            "Ro'yxatdan o'tgach CRM → Xarita orqali aniq nuqtani belgilang.",
            reply_markup=ReplyKeyboardRemove(),
        )
        await _advance_after_location(message, state, lat=lat, lon=lon, acc=None)
        return
    if lower == "joylashuvni yuborish":
        await message.answer(
            "Bu tugma faqat telefonda joylashuv yuboradi.\n"
            "Kompyuterda: 📎 → Location. Yoki «Keyinroq (CRM xaritadan)» tugmasini bosing.",
            reply_markup=location_keyboard(),
        )
        return
    await message.answer(
        "📍 Joylashuv qabul qilinmadi.\n\n"
        "📱 Mobil: «Joylashuvni yuborish» tugmasini bosing\n"
        "💻 Desktop: 📎 (Attach) → Location\n\n"
        "Yoki «Keyinroq (CRM xaritadan)» tugmasini bosing.",
        reply_markup=location_keyboard(),
    )


async def _ask_reg_phone(message: Message, state: FSMContext) -> None:
    await state.set_state(MerchantBotStates.reg_contact)
    await message.answer(
        "9/9 — Egasi telefon raqamini yuboring:\n"
        "• «Telefon raqamini yuborish» tugmasi (o'z raqamingiz)\n"
        "• yoki +998XXXXXXXXX ko'rinishida yozing (boshqa egasi raqami bo'lishi mumkin)",
        reply_markup=contact_keyboard(),
    )


@reg_router.message(MerchantBotStates.reg_storefront, F.photo)
async def reg_storefront(message: Message, state: FSMContext) -> None:
    if not message.photo:
        return
    photo = message.photo[-1]
    await state.update_data(reg_storefront_file_id=photo.file_id)
    await _ask_reg_phone(message, state)


@reg_router.message(MerchantBotStates.reg_storefront)
async def reg_storefront_fallback(message: Message, state: FSMContext) -> None:
    """Rasm o'rniga matn kelsa — yo'l-yo'riq beramiz yoki o'tkazib yuboramiz."""
    text = (message.text or "").strip().lower()
    if text in {"bekor qilish", "bekor"}:
        await state.clear()
        await message.answer("Ro'yxatdan o'tish bekor qilindi.", reply_markup=ReplyKeyboardRemove())
        return
    if text in {"keyinroq", "o'tkazib yuborish", "otkazib yuborish", "skip"}:
        await message.answer("Do'kon rasmi keyinroq CRM orqali qo'shiladi.")
        await _ask_reg_phone(message, state)
        return
    await message.answer(
        "8/9 — Do'kon (peshtaxta) RASMINI yuboring.\n"
        "Hozir rasm yo'q bo'lsa «Keyinroq» deb yozing — keyin CRM dan qo'shasiz."
    )


async def _advance_reg_phone(
    message: Message,
    state: FSMContext,
    *,
    phone: str,
    owner_name: str | None,
) -> None:
    async with AsyncSessionFactory() as session:
        svc = MerchantRegistrationService(session)
        if await svc.phone_already_registered(phone):
            await message.answer(
                "Bu telefon boshqa do'konda ro'yxatdan o'tgan. Boshqa raqam kiriting.",
                reply_markup=contact_keyboard(),
            )
            return

    data = await state.get_data()
    summary = (
        f"Do'kon: {data.get('reg_name')}\n"
        f"Turi: {data.get('reg_shop_type_label') or data.get('reg_shop_type')}\n"
        f"Bozor: {data.get('reg_market')}\n"
        f"Blok/qator: {data.get('reg_block')}\n"
        f"Raqam: {data.get('reg_stall')}\n"
        f"Izoh: {data.get('reg_location_comment')}\n"
        f"Telefon: {phone}\n\n"
        "Tasdiqlangach arizangiz platforma moderatoriga yuboriladi (odatda 24 soat ichida).\n"
        "Tasdiqlaysizmi?"
    )
    await state.update_data(reg_phone=phone, reg_owner_name=owner_name)
    await state.set_state(MerchantBotStates.reg_confirm)
    from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="Ha, ro'yxatdan o'tish", callback_data="reg:confirm"),
                InlineKeyboardButton(text="Bekor", callback_data="reg:cancel"),
            ]
        ]
    )
    await message.answer(summary, reply_markup=kb)


@reg_router.message(MerchantBotStates.reg_contact, F.contact)
async def reg_contact(message: Message, state: FSMContext) -> None:
    if not message.contact or not message.from_user:
        return
    phone = normalize_uz_phone(message.contact.phone_number or "")
    if not phone:
        await message.answer(
            "Telefon +998 formatida bo'lishi kerak.\n"
            "O'zbek raqamini yozing (masalan: +998901234567) yoki kontakt tugmasini bosing.",
            reply_markup=contact_keyboard(),
        )
        return
    owner_name = " ".join(
        p
        for p in [message.contact.first_name or "", message.contact.last_name or ""]
        if p
    ).strip()
    await _advance_reg_phone(message, state, phone=phone, owner_name=owner_name or None)


@reg_router.message(MerchantBotStates.reg_contact, F.text)
async def reg_contact_text(message: Message, state: FSMContext) -> None:
    text = (message.text or "").strip()
    if text.lower() in {"bekor qilish", "bekor"}:
        await state.clear()
        await message.answer("Ro'yxatdan o'tish bekor qilindi.", reply_markup=ReplyKeyboardRemove())
        return
    if text == "Telefon raqamini yuborish":
        await message.answer(
            "Tugmani bosib kontaktni yuboring yoki +998XXXXXXXXX yozing.",
            reply_markup=contact_keyboard(),
        )
        return

    phone = normalize_uz_phone(text)
    if not phone:
        await message.answer(
            "Telefon noto'g'ri. +998XXXXXXXXX yozing (masalan: +998976042102)\n"
            "yoki «Telefon raqamini yuborish» tugmasidan foydalaning.",
            reply_markup=contact_keyboard(),
        )
        return

    owner_name: str | None = None
    if message.from_user:
        owner_name = " ".join(
            p for p in [message.from_user.first_name or "", message.from_user.last_name or ""] if p
        ).strip() or None
    await _advance_reg_phone(message, state, phone=phone, owner_name=owner_name)


@reg_router.callback_query(F.data == "reg:cancel")
async def reg_cancel_cb(query: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    if query.message:
        await query.message.edit_text("Ro'yxatdan o'tish bekor qilindi.")
    await query.answer()


@reg_router.message(MerchantBotStates.reg_confirm)
async def reg_confirm_fallback(message: Message, state: FSMContext) -> None:
    """Tasdiqlash bosqichida matn kelsa — tugmalardan foydalanishni eslatamiz."""
    text = (message.text or "").strip().lower()
    if text in {"bekor qilish", "bekor", "yo'q", "yoq"}:
        await state.clear()
        await message.answer("Ro'yxatdan o'tish bekor qilindi.", reply_markup=ReplyKeyboardRemove())
        return
    await message.answer(
        "Iltimos, yuqoridagi «Ha, ro'yxatdan o'tish» yoki «Bekor» tugmasini bosing."
    )


@reg_router.callback_query(F.data == "reg:confirm")
async def reg_confirm_cb(query: CallbackQuery, state: FSMContext) -> None:
    if not query.message or not query.from_user:
        await query.answer()
        return
    data = await state.get_data()
    try:
        draft = MerchantRegistrationDraft(
            name=str(data["reg_name"]),
            shop_type=str(data.get("reg_shop_type") or "chakana"),
            market_zone=str(data["reg_market"]),
            block_sector=str(data["reg_block"]),
            stall_number=str(data["reg_stall"]),
            location_comment=str(data["reg_location_comment"]),
            latitude=float(data["reg_lat"]),
            longitude=float(data["reg_lon"]),
            location_accuracy=float(data["reg_loc_acc"]) if data.get("reg_loc_acc") else None,
            owner_phone=str(data["reg_phone"]),
            owner_display_name=data.get("reg_owner_name"),
            storefront_file_id=data.get("reg_storefront_file_id"),
            storefront_image_url=None,
            telegram_chat_id=int(query.message.chat.id),
            telegram_user_id=int(query.from_user.id),
            referral_code=data.get("reg_referral_code"),
        )
    except (KeyError, TypeError, ValueError):
        await query.message.answer("Ma'lumotlar to'liq emas. /register bilan qayta boshlang.")
        await query.answer()
        return

    await query.answer("Ro'yxatdan o'tilmoqda…")

    try:
        async with AsyncSessionFactory() as session:
            svc = MerchantRegistrationService(session)
            result = await svc.register_shop(draft)
    except ValueError as exc:
        await query.message.answer(str(exc))
        return
    except Exception:
        logger.exception("reg_confirm_failed")
        await query.message.answer("Ro'yxatdan o'tishda xatolik. Keyinroq urinib ko'ring.")
        return

    shop = result.shop
    await state.set_state(MerchantBotStates.ready)
    await state.update_data(shop_id=str(shop.id))

    text = (
        f"✅ Ariza qabul qilindi — «{shop.name}»\n\n"
        "Platforma moderatori tez orada ko'rib chiqadi (odatda 24 soat ichida).\n"
        "Tasdiqlangach Telegram orqali CRM login va parol yuboriladi.\n\n"
        "Hozircha mahsulot qo'shish mumkin emas — tasdiqdan keyin ochiladi."
    )
    await query.message.answer(text, reply_markup=pending_approval_keyboard())
