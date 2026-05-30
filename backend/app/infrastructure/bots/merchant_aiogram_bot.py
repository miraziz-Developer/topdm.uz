from __future__ import annotations

import asyncio
import io
import json
import logging
import uuid

from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.enums import ChatAction
from aiogram.types import Message

from app.application.merchant.smart_alerts import run_merchant_smart_alerts
from app.application.merchant.voice_handler import MerchantVoiceHandler
from app.core.config import get_settings
from app.infrastructure.bots.merchant_bot_ui import (
    contact_keyboard,
    merchant_menu_keyboard,
    start_inline_keyboard,
)
from app.infrastructure.bots.merchant_product_handlers import prod_router
from app.infrastructure.bots.merchant_registration_handlers import reg_router
from app.infrastructure.bots.merchant_states import MerchantBotStates
from app.infrastructure.bots.merchant_phone import phones_match
from app.infrastructure.db.session import AsyncSessionFactory
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway
from app.infrastructure.messaging.telegram_otp import telegram_otp_gateway
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository

logger = logging.getLogger(__name__)

router = Router(name="merchant")
_voice_handler = MerchantVoiceHandler()


async def _shop_for_chat(chat_id: int):
    async with AsyncSessionFactory() as session:
        return await MarketplaceRepository(session).get_shop_by_telegram_chat_id(chat_id)


def _parse_shop_uuid(args: str | None) -> uuid.UUID | None:
    raw = (args or "").strip()
    if not raw.startswith("shop_"):
        return None
    token = raw.removeprefix("shop_").strip()
    try:
        return uuid.UUID(token)
    except ValueError:
        return None


@router.message(CommandStart())
async def cmd_start(message: Message, command: CommandObject, state: FSMContext) -> None:
    if message.from_user:
        await telegram_otp_gateway.register_chat(
            telegram_id=message.from_user.id,
            username=message.from_user.username,
        )

    shop_uuid = _parse_shop_uuid(command.args)
    if shop_uuid is None:
        existing = await _shop_for_chat(int(message.chat.id))
        if existing is not None:
            await state.set_state(MerchantBotStates.ready)
            await state.update_data(shop_id=str(existing.id))
            await message.answer(
                f"Qayta xush kelibsiz, {existing.name}!\n\n"
                "Rasm yuboring — AI to'ldiradi, tasdiqlang.\n"
                "CRM Panel — buyurtma va chat.",
                reply_markup=merchant_menu_keyboard(existing.id),
            )
            await message.answer("Tezkor:", reply_markup=start_inline_keyboard(existing.id))
            return

        await message.answer(
            "Topdim Merchant bot\n\n"
            "Yangi do'kon: /register — ro'yxatdan o'tish (8 qadam)\n"
            "Admin havolasi: /start shop_<UUID> + kontakt\n\n"
            "CRM: login + parol yoki Telegram OTP",
            reply_markup=start_inline_keyboard(None),
        )
        return

    await state.clear()
    await state.set_state(MerchantBotStates.waiting_contact)
    await state.update_data(shop_id=str(shop_uuid))
    await message.answer(
        f"Do'kon UUID: {shop_uuid}\n\n"
        "Egasi telefonini yuboring (bazadagi raqam bilan mos bo'lishi kerak).",
        reply_markup=contact_keyboard(),
    )


@router.message(Command("help"))
@router.message(Command("yordam"))
async def cmd_help(message: Message) -> None:
    await message.answer(
        "/register — yangi do'kon ro'yxatdan o'tish\n"
        "/start shop_<UUID> — admin havolasi\n"
        "/crm — CRM tugmalari\n"
        "Rasm — mahsulot (AI + tasdiq)\n"
        "Ovoz — mahsulot qoralama"
    )


@router.message(Command("crm"))
async def cmd_crm(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    shop_id: uuid.UUID | None = None
    shop_raw = data.get("shop_id")
    if shop_raw:
        try:
            shop_id = uuid.UUID(str(shop_raw))
        except ValueError:
            shop_id = None
    if shop_id is None:
        bound = await _shop_for_chat(int(message.chat.id))
        if bound:
            shop_id = bound.id
            await state.set_state(MerchantBotStates.ready)
            await state.update_data(shop_id=str(shop_id))
    if shop_id is None:
        await message.answer("Avval /register yoki /start shop_<UUID> bilan ulaning.")
        return
    await message.answer(
        "CRM va xarita:",
        reply_markup=merchant_menu_keyboard(shop_id),
    )
    await message.answer("Yoki:", reply_markup=start_inline_keyboard(shop_id))


@router.message(MerchantBotStates.waiting_contact, F.contact)
async def on_contact(message: Message, state: FSMContext) -> None:
    if not message.contact or not message.from_user:
        return
    data = await state.get_data()
    shop_raw = data.get("shop_id")
    if not shop_raw:
        await state.clear()
        return
    try:
        shop_id = uuid.UUID(str(shop_raw))
    except ValueError:
        await message.answer("Noto'g'ri UUID.")
        await state.clear()
        return

    async with AsyncSessionFactory() as session:
        repo = MarketplaceRepository(session)
        shop = await repo.get_shop(shop_id)
        if shop is None:
            await message.answer("Do'kon topilmadi.")
            await state.clear()
            return
        if not phones_match(shop.owner_phone, message.contact.phone_number):
            await message.answer("Telefon raqam mos emas. Qayta urinib ko'ring.")
            return
        await repo.bind_shop_telegram_chat(shop.id, int(message.chat.id))

    await state.set_state(MerchantBotStates.ready)
    await state.update_data(shop_id=str(shop_id))
    await message.answer(
        "Do'kon ulandi.\nRasm yuboring — AI mahsulot to'ldiradi.",
        reply_markup=merchant_menu_keyboard(shop_id),
    )
    await message.answer("Tezkor:", reply_markup=start_inline_keyboard(shop_id))


@router.message(MerchantBotStates.ready, F.web_app_data)
async def on_web_app_data(message: Message) -> None:
    if not message.web_app_data:
        return
    try:
        payload = json.loads(message.web_app_data.data)
    except json.JSONDecodeError:
        await message.answer("Mini App ma'lumoti noto'g'ri.")
        return
    action = payload.get("action")
    if action == "precision_saved":
        await message.answer("Joylashuv saqlandi.")
    elif action == "draft_sync":
        await message.answer("Qoralama sinxronlandi.")
    else:
        await message.answer(f"OK: {action or 'done'}")


async def _process_voice_background(
    *,
    bot: Bot,
    chat_id: int,
    shop_id: uuid.UUID,
    audio_bytes: bytes,
    telegram_user_id: int,
    telegram_file_id: str,
) -> None:
    settings = get_settings()
    if not settings.openai_api_key:
        await bot.send_message(chat_id, "Whisper sozlanmagan (OPENAI_API_KEY).")
        return
    try:
        async with AsyncSessionFactory() as session:
            result = await _voice_handler.process(
                session,
                shop_id=shop_id,
                audio_bytes=audio_bytes,
                telegram_user_id=telegram_user_id,
                telegram_chat_id=chat_id,
                telegram_file_id=telegram_file_id,
            )
        reply = MerchantVoiceHandler.format_telegram_reply(result)
        await bot.send_message(
            chat_id,
            reply + "\n\nCRM dan kategoriya va narxni tasdiqlang.",
        )
    except Exception:
        logger.exception("voice_background_failed")
        await bot.send_message(chat_id, "Ovozda xatolik. Qayta urinib ko'ring.")


@router.message(MerchantBotStates.ready, F.voice)
async def on_voice(message: Message, state: FSMContext, bot: Bot) -> None:
    if not message.voice or not message.from_user:
        return
    data = await state.get_data()
    shop_raw = data.get("shop_id")
    if not shop_raw:
        await message.answer("Avval /register bilan ro'yxatdan o'ting.")
        return
    shop_id = uuid.UUID(str(shop_raw))
    buf = io.BytesIO()
    try:
        await bot.download(message.voice, destination=buf)
    except Exception:
        await message.answer("Ovozni yuklab bo'lmadi.")
        return
    await bot.send_chat_action(message.chat.id, ChatAction.RECORD_VOICE)
    await message.answer("Ovoz qabul qilindi, AI tahlil qilmoqda…")
    asyncio.create_task(
        _process_voice_background(
            bot=bot,
            chat_id=int(message.chat.id),
            shop_id=shop_id,
            audio_bytes=buf.getvalue(),
            telegram_user_id=int(message.from_user.id),
            telegram_file_id=message.voice.file_id,
        )
    )


async def _smart_alerts_loop() -> None:
    settings = get_settings()
    while True:
        await asyncio.sleep(3600)
        if not settings.telegram_bot_token:
            continue
        try:
            async with AsyncSessionFactory() as session:
                notifier = TelegramNotifierGateway(settings.telegram_bot_token)
                sent = await run_merchant_smart_alerts(session, notifier)
                if sent:
                    logger.info("merchant_smart_alerts_sent", extra={"count": sent})
        except Exception:
            logger.exception("merchant_smart_alerts_loop_failed")


async def run_merchant_bot_polling() -> None:
    settings = get_settings()
    if not settings.telegram_bot_token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is required to run the merchant bot")
    bot = Bot(token=settings.telegram_bot_token)
    dp = Dispatcher(storage=MemoryStorage())
    dp.include_router(reg_router)
    dp.include_router(prod_router)
    dp.include_router(router)
    asyncio.create_task(_smart_alerts_loop())
    await dp.start_polling(bot)
