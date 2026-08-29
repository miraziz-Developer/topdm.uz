"""Telefon OTP — Redis + kanal: Telegram bot (bepul) yoki Eskiz SMS (zaxira)."""
from __future__ import annotations

import random
import re
import secrets
import time

import httpx
from loguru import logger

from app.core.config import get_settings
from app.infrastructure.cache.redis_gateway import RedisCacheGateway

_PHONE_RE = re.compile(r"^\+998\d{9}$")
_OTP_TTL = 300
_TG_LINK_TTL = 600
_ESKIZ_TOKEN_CACHE: dict[str, object] = {"token": "", "expires_at": 0.0}


class PhoneOtpError(Exception):
    def __init__(self, message: str, *, code: str = "phone_otp_error") -> None:
        self.message = message
        self.code = code
        super().__init__(message)


def normalize_phone_e164(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("998") and len(digits) >= 12:
        return f"+{digits[:12]}"
    if len(digits) == 9:
        return f"+998{digits}"
    raw = (phone or "").strip()
    if _PHONE_RE.match(raw):
        return raw
    raise PhoneOtpError("Telefon raqami +998XXXXXXXXX formatida bo'lishi kerak", code="invalid_phone")


def _otp_key(phone: str) -> str:
    return f"otp:phone:{phone.replace('+', '')}"


def _verified_key(phone: str) -> str:
    return f"otp:phone:verified:{phone.replace('+', '')}"


def _tg_link_key(nonce: str) -> str:
    return f"otp:phone:tglink:{nonce}"


class PhoneOtpGateway:
    async def issue_otp(self, phone: str) -> dict:
        settings = get_settings()
        normalized = normalize_phone_e164(phone)
        otp = f"{random.randint(100000, 999999)}"
        await RedisCacheGateway().set(
            _otp_key(normalized),
            {"otp": otp, "phone": normalized},
            _OTP_TTL,
        )

        delivery = "redis"
        try:
            await self._send_sms(normalized, otp)
            delivery = "eskiz"
        except PhoneOtpError as exc:
            if settings.is_production and not settings.app_debug:
                raise
            logger.warning("phone_otp_sms_skipped phone={} reason={}", normalized, exc.message)
            delivery = "dev"

        response: dict = {"status": "ok", "phone": normalized, "delivery": delivery}
        if settings.app_debug and not settings.is_production:
            response["dev_otp"] = otp
        return response

    async def issue_telegram_link(self, phone: str) -> dict:
        """Bepul kanal — foydalanuvchi havolani ochadi, mijoz boti kodni chatga yuboradi."""
        settings = get_settings()
        bot_username = settings.effective_customer_bot_username
        if not settings.effective_customer_bot_token or not bot_username:
            raise PhoneOtpError("Telegram bot sozlanmagan", code="telegram_not_configured")

        normalized = normalize_phone_e164(phone)
        nonce = secrets.token_urlsafe(18)
        await RedisCacheGateway().set(
            _tg_link_key(nonce),
            {"phone": normalized},
            _TG_LINK_TTL,
        )
        return {
            "status": "ok",
            "phone": normalized,
            "delivery": "telegram_link",
            "deep_link": f"https://t.me/{bot_username}?start=verify_{nonce}",
            "expires_in": _TG_LINK_TTL,
        }

    async def resolve_telegram_link(self, nonce: str) -> str | None:
        """Bot /start bosilganda: nonce bo'yicha telefonni qaytaradi (nonce saqlanadi)."""
        clean = (nonce or "").strip()
        if not clean:
            return None
        data = await RedisCacheGateway().get(_tg_link_key(clean))
        if not data:
            return None
        phone = str(data.get("phone") or "")
        return phone if _PHONE_RE.match(phone) else None

    async def complete_telegram_link(self, nonce: str, shared_phone: str) -> tuple[str, str] | None:
        """Bot foydalanuvchi kontaktini ulashganda: raqam mos kelsa OTP yozadi.

        Telegram ulashgan raqam checkoutdagi raqamga teng bo'lishi shart — bu
        telefon egaligini isbotlaydi. (phone, otp) yoki None qaytaradi.
        """
        clean = (nonce or "").strip()
        if not clean:
            return None
        data = await RedisCacheGateway().get(_tg_link_key(clean))
        if not data:
            return None
        phone = str(data.get("phone") or "")
        if not _PHONE_RE.match(phone):
            return None
        try:
            if normalize_phone_e164(shared_phone) != phone:
                return None
        except PhoneOtpError:
            return None

        await RedisCacheGateway().delete(_tg_link_key(clean))
        otp = f"{random.randint(100000, 999999)}"
        await RedisCacheGateway().set(
            _otp_key(phone),
            {"otp": otp, "phone": phone, "via": "telegram"},
            _OTP_TTL,
        )
        return phone, otp

    async def verify_otp(self, phone: str, otp: str) -> str:
        normalized = normalize_phone_e164(phone)
        data = await RedisCacheGateway().get(_otp_key(normalized))
        if not data or str(data.get("otp")) != str(otp).strip():
            raise PhoneOtpError("Kod noto'g'ri yoki muddati tugagan", code="invalid_otp")

        await RedisCacheGateway().delete(_otp_key(normalized))
        token = f"{normalized}:{random.randint(100_000, 999_999)}"
        await RedisCacheGateway().set(_verified_key(normalized), {"token": token}, 1800)
        return token

    async def assert_verified(self, phone: str, token: str | None) -> None:
        if not token:
            raise PhoneOtpError("Tasdiqlash kodi talab qilinadi", code="otp_required")
        normalized = normalize_phone_e164(phone)
        data = await RedisCacheGateway().get(_verified_key(normalized))
        if not data or str(data.get("token")) != str(token).strip():
            raise PhoneOtpError("Avval telefonni SMS kod bilan tasdiqlang", code="otp_not_verified")

    async def _send_sms(self, phone: str, otp: str) -> None:
        settings = get_settings()
        email = (settings.eskiz_email or "").strip()
        password = (settings.eskiz_password or "").strip()
        token = (settings.eskiz_api_token or "").strip()
        if not token and (not email or not password):
            raise PhoneOtpError("SMS provayder sozlanmagan", code="sms_not_configured")

        bearer = token or await self._eskiz_token(email, password)
        from_name = (settings.eskiz_from or "4546").strip()
        digits = phone.lstrip("+")
        text = f"Bozorliii tasdiqlash kodi: {otp}. Hech kimga bermang."

        async with httpx.AsyncClient(timeout=float(settings.external_api_timeout_seconds)) as client:
            resp = await client.post(
                "https://notify.eskiz.uz/api/message/sms/send",
                headers={"Authorization": f"Bearer {bearer}"},
                data={
                    "mobile_phone": digits,
                    "message": text,
                    "from": from_name,
                },
            )
        if resp.status_code >= 400:
            raise PhoneOtpError(f"SMS yuborilmadi ({resp.status_code})", code="sms_send_failed")

    async def _eskiz_token(self, email: str, password: str) -> str:
        now = time.time()
        cached = str(_ESKIZ_TOKEN_CACHE.get("token") or "")
        if cached and float(_ESKIZ_TOKEN_CACHE.get("expires_at") or 0) > now + 60:
            return cached

        settings = get_settings()
        async with httpx.AsyncClient(timeout=float(settings.external_api_timeout_seconds)) as client:
            resp = await client.post(
                "https://notify.eskiz.uz/api/auth/login",
                data={"email": email, "password": password},
            )
        if resp.status_code >= 400:
            raise PhoneOtpError("Eskiz autentifikatsiyasi muvaffaqiyatsiz", code="eskiz_auth_failed")
        data = resp.json()
        token = str(data.get("data", {}).get("token") or data.get("token") or "")
        if not token:
            raise PhoneOtpError("Eskiz token topilmadi", code="eskiz_token_missing")
        _ESKIZ_TOKEN_CACHE["token"] = token
        _ESKIZ_TOKEN_CACHE["expires_at"] = now + 23 * 3600
        return token


phone_otp_gateway = PhoneOtpGateway()
