"""Bozorliii mijoz boti (@Bozorliii_bot).

Ayni damda faqat bitta vazifa: mehmon xaridorlarning telefon raqamini
tasdiqlash (SMS o'rniga bepul kanal). Merchant botdan ajratilgan - sotuvchi
va xaridor oqimlari aralashmasin. Keyinroq bu yerga buyurtma xabarlari ham
qo'shiladi.

Ishga tushirish: scripts/run_customer_bot.py (customer-bot konteyneri).
"""
from __future__ import annotations

import logging

from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import (
    ErrorEvent,
    KeyboardButton,
    Message,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
)

from app.core.config import get_settings
from app.infrastructure.bots.customer_states import CustomerBotStates
from app.infrastructure.bots.fsm_storage import build_fsm_storage
from app.infrastructure.cache.redis_gateway import RedisCacheGateway
from app.infrastructure.messaging.phone_otp import phone_otp_gateway

logger = logging.getLogger(__name__)

router = Router(name="customer")

_SITE_URL = "https://bozorliii.online"


def _share_contact_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="Telefon raqamini yuborish", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def _parse_verify_nonce(args: str | None) -> str | None:
    raw = (args or "").strip()
    if not raw.startswith("verify_"):
        return None
    return raw.removeprefix("verify_").strip() or None


def _pending_key(chat_id: int) -> str:
    return f"otp:phone:tgverify:chat:{int(chat_id)}"


@router.message(CommandStart())
async def cmd_start(message: Message, command: CommandObject, state: FSMContext) -> None:
    await state.clear()
    nonce = _parse_verify_nonce(command.args)
    if nonce is None:
        await message.answer(
            "Bu - Bozorliii xaridorlar boti.\n\n"
            f"Buyurtma berish uchun saytga o'ting: {_SITE_URL}\n"
            "Telefon raqamini tasdiqlash kerak bo'lganda, sayt sizni shu botga "
            "yo'naltiradi.",
            reply_markup=ReplyKeyboardRemove(),
        )
        return

    phone = await phone_otp_gateway.resolve_telegram_link(nonce)
    if phone is None:
        await message.answer(
            "Bu tasdiqlash havolasi eskirgan yoki allaqachon ishlatilgan.\n\n"
            "Saytga qaytib \"Telegram orqali kod olish\" tugmasini qayta bosing.",
            reply_markup=ReplyKeyboardRemove(),
        )
        return

    await state.set_state(CustomerBotStates.verify_contact)
    await RedisCacheGateway().set(_pending_key(message.chat.id), {"nonce": nonce}, 600)
    masked = f"{phone[:7]}...{phone[-2:]}"
    await message.answer(
        f"<b>{masked}</b> raqamini tasdiqlash\n\n"
        "Pastdagi tugma orqali Telegram raqamingizni ulashing - u saytda kiritgan "
        "raqamga mos kelsa, tasdiqlash kodini shu yerga yuboramiz.",
        parse_mode="HTML",
        reply_markup=_share_contact_keyboard(),
    )


@router.message(CustomerBotStates.verify_contact, F.contact)
async def on_verify_contact(message: Message, state: FSMContext) -> None:
    await state.clear()
    if not message.contact:
        return
    pending = await RedisCacheGateway().get(_pending_key(message.chat.id))
    await RedisCacheGateway().delete(_pending_key(message.chat.id))
    nonce = str(pending.get("nonce") or "") if pending else ""

    result = await phone_otp_gateway.complete_telegram_link(
        nonce, message.contact.phone_number or ""
    )
    if result is None:
        await message.answer(
            "Ulashgan raqam saytda kiritilgan raqamga mos kelmadi yoki havola eskirgan.\n\n"
            "Saytga qaytib to'g'ri raqam bilan qayta urinib ko'ring.",
            reply_markup=ReplyKeyboardRemove(),
        )
        return

    _phone, otp = result
    await message.answer(
        "<b>Bozorliii tasdiqlash kodi</b>\n\n"
        f"<code>{otp}</code>\n\n"
        "Kodni saytdagi oynaga kiriting. Amal qilish muddati - 5 daqiqa.\n"
        "Bu kodni hech kimga bermang.",
        parse_mode="HTML",
        reply_markup=ReplyKeyboardRemove(),
    )


@router.message(CustomerBotStates.verify_contact, F.text.regexp(r"^(?!/)"))
async def on_verify_other(message: Message) -> None:
    await message.answer(
        "Iltimos, pastdagi \"Telefon raqamini yuborish\" tugmasini bosing.",
        reply_markup=_share_contact_keyboard(),
    )


@router.message(Command("help", "yordam"))
async def cmd_help(message: Message) -> None:
    await message.answer(
        f"Bozorliii xaridorlar boti. Buyurtma berish: {_SITE_URL}",
        reply_markup=ReplyKeyboardRemove(),
    )


async def run_customer_bot_polling() -> None:
    settings = get_settings()
    token = settings.effective_customer_bot_token
    if not token:
        raise RuntimeError("CUSTOMER_BOT_TOKEN (yoki TELEGRAM_BOT_TOKEN) kerak")

    bot = Bot(token=token)
    dp = Dispatcher(storage=build_fsm_storage(settings.redis_url))

    async def _on_error(event: ErrorEvent) -> bool:
        logger.exception("customer_bot_error", exc_info=event.exception)
        msg = event.update.message if event.update else None
        if msg is not None:
            try:
                await bot.send_message(
                    msg.chat.id, "Xatolik yuz berdi. /start bilan qayta urinib ko'ring."
                )
            except Exception:
                logger.exception("customer_bot_error_fallback_failed")
        return True

    dp.errors.register(_on_error)
    dp.include_router(router)
    logger.info("customer_bot_polling_start")
    await dp.start_polling(bot)
