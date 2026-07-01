from __future__ import annotations

import re

import httpx
from loguru import logger

from app.core.config import get_settings
from app.infrastructure.cache.redis_gateway import RedisCacheGateway

_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_RESEND_API = "https://api.resend.com/emails"
_OTP_TTL_SECONDS = 300


class ResendEmailError(Exception):
    def __init__(self, message: str, *, code: str = "resend_error") -> None:
        self.message = message
        self.code = code
        super().__init__(message)


def normalize_email(value: str) -> str:
    return value.strip().lower()


def is_valid_email(value: str) -> bool:
    return bool(_EMAIL_PATTERN.match(normalize_email(value)))


def _otp_key(email: str, *, link_user_id: str | None = None) -> str:
    normalized = normalize_email(email)
    if link_user_id:
        return f"otp:email:link:{link_user_id}:{normalized}"
    return f"otp:email:{normalized}"


def build_otp_html(*, otp: str, brand: str = "Bozorliii") -> str:
    return f"""<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{brand} — tasdiqlash kodi</title>
</head>
<body style="margin:0;padding:0;background:#f2f4f8;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f4f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#2563eb 0%,#7c3aed 100%);padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.85);">Tasdiqlash</p>
              <h1 style="margin:8px 0 0;font-size:24px;font-weight:700;color:#ffffff;">{brand}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 12px;text-align:center;">
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#475569;">Kirish uchun quyidagi kodni kiriting:</p>
              <div style="display:inline-block;padding:16px 28px;border-radius:14px;background:#f8fafc;border:2px dashed #cbd5e1;">
                <span style="font-size:32px;font-weight:800;letter-spacing:0.35em;color:#0f172a;">{otp}</span>
              </div>
              <p style="margin:20px 0 0;font-size:13px;color:#64748b;">Kod <strong>5 daqiqa</strong> amal qiladi.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;text-align:center;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">Agar siz bu kodni so'ramagan bo'lsangiz, xabarni e'tiborsiz qoldiring.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#f8fafc;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">© {brand} · Toshkent bozorlari uchun AI platforma</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def build_order_status_html(
    *,
    title: str,
    body: str,
    product_name: str,
    order_url: str,
    brand: str = "Bozorliii",
) -> str:
    safe_title = title.replace("<", "&lt;").replace(">", "&gt;")
    safe_body = body.replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")
    safe_product = product_name.replace("<", "&lt;").replace(">", "&gt;")
    return f"""<!DOCTYPE html>
<html lang="uz">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f2f4f8;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f4f8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(15,23,42,0.08);">
        <tr><td style="background:linear-gradient(135deg,#2563eb 0%,#7c3aed 100%);padding:24px 28px;text-align:center;">
          <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;">{safe_title}</h1>
        </td></tr>
        <tr><td style="padding:28px 24px;">
          <p style="margin:0 0 8px;font-size:14px;color:#64748b;">Mahsulot</p>
          <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a;">{safe_product}</p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#475569;">{safe_body}</p>
          <p style="margin:24px 0 0;text-align:center;">
            <a href="{order_url}" style="display:inline-block;padding:12px 24px;border-radius:12px;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;">Buyurtmani ochish</a>
          </p>
        </td></tr>
        <tr><td style="padding:12px 24px 20px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:11px;color:#94a3b8;">© {brand}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


class ResendEmailGateway:
    async def store_otp(self, *, to_email: str, otp: str, link_user_id: str | None = None) -> str:
        normalized = normalize_email(to_email)
        await RedisCacheGateway().set(
            _otp_key(normalized, link_user_id=link_user_id),
            {"otp": otp, "email": normalized},
            _OTP_TTL_SECONDS,
        )
        return normalized

    async def dispatch_email(self, *, to_email: str, otp: str) -> None:
        settings = get_settings()
        if not settings.resend_api_key:
            logger.error("resend_skip_no_api_key", extra={"email": to_email})
            return

        normalized = normalize_email(to_email)
        payload = {
            "from": settings.resend_from_email,
            "to": [normalized],
            "subject": "Bozorliii — tasdiqlash kodi",
            "html": build_otp_html(otp=otp),
        }
        headers = {
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post(_RESEND_API, json=payload, headers=headers)
            if response.status_code >= 400:
                logger.warning(
                    "resend_background_send_failed",
                    extra={"email": normalized, "status": response.status_code, "body": response.text[:200]},
                )
                return
            logger.info("resend_otp_sent", extra={"email": normalized})
        except httpx.HTTPError:
            logger.exception("resend_background_http_error", extra={"email": normalized})

    async def send_otp(self, *, to_email: str, otp: str, link_user_id: str | None = None) -> None:
        """Synchronous path: store OTP and send email (used in tests / no background)."""
        settings = get_settings()
        if not settings.resend_api_key:
            raise ResendEmailError("RESEND_API_KEY sozlanmagan", code="resend_not_configured")

        normalized = await self.store_otp(to_email=to_email, otp=otp, link_user_id=link_user_id)
        payload = {
            "from": settings.resend_from_email,
            "to": [normalized],
            "subject": "Bozorliii — tasdiqlash kodi",
            "html": build_otp_html(otp=otp),
        }
        headers = {
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post(_RESEND_API, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            await RedisCacheGateway().delete(_otp_key(normalized, link_user_id=link_user_id))
            raise ResendEmailError("Resend serveriga ulanib bo'lmadi", code="resend_unreachable") from exc

        if response.status_code >= 400:
            await RedisCacheGateway().delete(_otp_key(normalized, link_user_id=link_user_id))
            if response.status_code in {401, 403}:
                raise ResendEmailError("Resend API kaliti noto'g'ri", code="resend_auth_failed")
            if response.status_code == 422:
                raise ResendEmailError(
                    "Email yuborilmadi. RESEND_FROM manzilini Resend dashboardda tasdiqlang.",
                    code="resend_from_invalid",
                )
            raise ResendEmailError("Email yuborib bo'lmadi", code="resend_send_failed")

        logger.info("resend_otp_sent", extra={"email": normalized})

    async def send_order_status(
        self,
        *,
        to_email: str,
        title: str,
        body: str,
        product_name: str,
        order_url: str,
    ) -> None:
        settings = get_settings()
        if not settings.resend_api_key:
            logger.debug("resend_order_status_skipped_no_key", extra={"email": to_email})
            return

        normalized = normalize_email(to_email)
        payload = {
            "from": settings.resend_from_email,
            "to": [normalized],
            "subject": f"Bozorliii — {title}",
            "html": build_order_status_html(
                title=title,
                body=body,
                product_name=product_name,
                order_url=order_url,
            ),
        }
        headers = {
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post(_RESEND_API, json=payload, headers=headers)
            if response.status_code >= 400:
                logger.warning(
                    "resend_order_status_failed",
                    extra={"email": normalized, "status": response.status_code, "body": response.text[:200]},
                )
                return
            logger.info("resend_order_status_sent", extra={"email": normalized, "title": title})
        except httpx.HTTPError:
            logger.exception("resend_order_status_http_error", extra={"email": normalized})

    async def verify_otp(self, *, email: str, otp: str, link_user_id: str | None = None) -> str:
        normalized = normalize_email(email)
        data = await RedisCacheGateway().get(_otp_key(normalized, link_user_id=link_user_id))
        if not data or str(data.get("otp")) != str(otp).strip():
            raise ResendEmailError("Kod noto'g'ri yoki muddati tugagan", code="invalid_otp")
        await RedisCacheGateway().delete(_otp_key(normalized, link_user_id=link_user_id))
        return normalized


resend_email_gateway = ResendEmailGateway()


async def send_otp_email_background(*, to_email: str, otp: str) -> None:
    await resend_email_gateway.dispatch_email(to_email=to_email, otp=otp)
