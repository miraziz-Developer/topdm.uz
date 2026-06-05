from __future__ import annotations

import re

import httpx
from loguru import logger

from app.core.config import get_settings
from app.infrastructure.cache.redis_gateway import RedisCacheGateway

_USERNAME_PATTERN = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]{4,31}$")
_CHAT_REGISTRY_TTL = 60 * 60 * 24 * 90  # 90 days


class TelegramOtpError(Exception):
    def __init__(self, message: str, *, code: str = "telegram_otp_error") -> None:
        self.message = message
        self.code = code
        super().__init__(message)


class BotNotStartedError(TelegramOtpError):
    def __init__(self, bot_username: str) -> None:
        handle = f"@{bot_username.lstrip('@')}" if bot_username else "@bot"
        super().__init__(
            f"Iltimos, avval {handle} ni ochib /start bosing",
            code="bot_not_started",
        )


def normalize_telegram_username(value: str) -> str:
    return value.strip().lstrip("@").lower()


def is_valid_telegram_username(value: str) -> bool:
    return bool(_USERNAME_PATTERN.match(normalize_telegram_username(value)))


def _registry_key(username: str) -> str:
    return f"tg:otp:registry:{normalize_telegram_username(username)}"


def _otp_key(username: str, *, link_user_id: str | None = None) -> str:
    user = normalize_telegram_username(username)
    if link_user_id:
        return f"otp:tg:link:{link_user_id}:{user}"
    return f"otp:tg:{user}"


def _otp_chat_key(chat_id: int) -> str:
    return f"otp:tg:chat:{int(chat_id)}"


class TelegramOtpGateway:
    async def register_chat(self, *, telegram_id: int, username: str | None) -> None:
        if not username:
            return
        normalized = normalize_telegram_username(username)
        if not is_valid_telegram_username(normalized):
            return
        await RedisCacheGateway().set(
            _registry_key(normalized),
            {"telegram_id": telegram_id, "username": normalized},
            _CHAT_REGISTRY_TTL,
        )

    async def resolve_telegram_id(self, username: str) -> int | None:
        data = await RedisCacheGateway().get(_registry_key(username))
        if not data:
            return None
        raw = data.get("telegram_id")
        return int(raw) if raw is not None else None

    async def send_otp(self, *, username: str, otp: str, link_user_id: str | None = None) -> None:
        settings = get_settings()
        if not settings.telegram_bot_token:
            raise TelegramOtpError("TELEGRAM_BOT_TOKEN sozlanmagan", code="telegram_not_configured")

        normalized = normalize_telegram_username(username)
        if not is_valid_telegram_username(normalized):
            raise TelegramOtpError("Telegram username noto'g'ri (@username, kamida 5 belgi)", code="invalid_username")

        telegram_id = await self.resolve_telegram_id(normalized)
        if telegram_id is None:
            raise BotNotStartedError(settings.telegram_bot_username or "bot")

        text = f"Bozorliii tasdiqlash kodingiz: {otp}"
        await self._send_message(telegram_id=telegram_id, text=text)

        await RedisCacheGateway().set(
            _otp_key(normalized, link_user_id=link_user_id),
            {"otp": otp, "telegram_id": telegram_id, "username": normalized},
            300,
        )

    async def send_otp_to_chat(self, *, chat_id: int, otp: str) -> None:
        settings = get_settings()
        if not settings.telegram_bot_token:
            raise TelegramOtpError("TELEGRAM_BOT_TOKEN sozlanmagan", code="telegram_not_configured")
        text = f"Bozorliii CRM kirish kodingiz: {otp}"
        await self._send_message(telegram_id=int(chat_id), text=text)
        await RedisCacheGateway().set(
            _otp_chat_key(chat_id),
            {"otp": otp, "telegram_id": int(chat_id)},
            300,
        )

    async def verify_otp_for_chat(self, *, chat_id: int, otp: str) -> int:
        data = await RedisCacheGateway().get(_otp_chat_key(chat_id))
        if not data or str(data.get("otp")) != str(otp).strip():
            raise TelegramOtpError("Kod noto'g'ri yoki muddati tugagan", code="invalid_otp")
        await RedisCacheGateway().delete(_otp_chat_key(chat_id))
        telegram_id = data.get("telegram_id")
        if telegram_id is None:
            raise TelegramOtpError("Telegram sessiyasi topilmadi", code="invalid_otp")
        return int(telegram_id)

    async def verify_otp(self, *, username: str, otp: str, link_user_id: str | None = None) -> int:
        normalized = normalize_telegram_username(username)
        data = await RedisCacheGateway().get(_otp_key(normalized, link_user_id=link_user_id))
        if not data or str(data.get("otp")) != str(otp).strip():
            raise TelegramOtpError("Kod noto'g'ri yoki muddati tugagan", code="invalid_otp")
        await RedisCacheGateway().delete(_otp_key(normalized, link_user_id=link_user_id))
        telegram_id = data.get("telegram_id")
        if telegram_id is None:
            raise TelegramOtpError("Telegram sessiyasi topilmadi", code="invalid_otp")
        return int(telegram_id)

    async def _send_message(self, *, telegram_id: int, text: str) -> None:
        settings = get_settings()
        url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
        payload = {"chat_id": telegram_id, "text": text}
        try:
            async with httpx.AsyncClient(timeout=12) as client:
                response = await client.post(url, json=payload)
                body = response.json()
        except httpx.HTTPError as exc:
            logger.exception("telegram_otp_http_error", extra={"telegram_id": telegram_id})
            raise TelegramOtpError("Telegram serveriga ulanib bo'lmadi", code="telegram_unreachable") from exc

        if body.get("ok"):
            return

        description = str(body.get("description", "")).lower()
        logger.warning(
            "telegram_otp_send_failed",
            extra={"telegram_id": telegram_id, "description": description},
        )
        if "can't initiate conversation" in description or "chat not found" in description or "blocked" in description:
            raise BotNotStartedError(settings.telegram_bot_username or "bot")
        raise TelegramOtpError("Telegram orqali kod yuborib bo'lmadi", code="telegram_send_failed")


telegram_otp_gateway = TelegramOtpGateway()
