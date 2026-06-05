from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timezone

from fastapi import Header, HTTPException, Request, status
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.topdmbozor.notifications import notify_merchant_order_paid
from app.application.topdmbozor.sms_parser import parse_click_p2p_sms
from app.core.config import Settings, get_settings
from app.infrastructure.repositories.topdmbozor_repo import TopdmbozorRepository
from app.models.topdmbozor import TdbOrderStatus
from app.schemas.topdmbozor import SmsWebhookResponse

TDB_SIGNATURE_HEADER = "X-TDB-Signature"


def compute_sms_webhook_signature(payload_bytes: bytes, secret: str) -> str:
    """SMS-Gate ilovasi ham shu formuladan foydalanadi: HMAC-SHA256(hex)."""
    return hmac.new(
        key=secret.encode("utf-8"),
        msg=payload_bytes,
        digestmod=hashlib.sha256,
    ).hexdigest()


def _normalize_signature(value: str) -> str:
    raw = (value or "").strip()
    if raw.lower().startswith("sha256="):
        return raw[7:].strip()
    return raw


async def verify_sms_webhook_signature(
    request: Request,
    x_tdb_signature: str | None = Header(default=None, alias=TDB_SIGNATURE_HEADER),
) -> bytes:
    """
    Kelayotgan SMS webhook so'rovini HMAC-SHA256 orqali tekshirish.
    Imzo xom HTTP body (JSON baytlari) ustida hisoblanadi.
    """
    payload_bytes = await request.body()
    settings = get_settings()
    secret = (settings.tdb_sms_webhook_secret or "").strip()

    if not secret:
        if settings.is_production:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Webhook secret key is not configured in production .env",
            )
        logger.warning("tdb_webhook_hmac_skipped reason=secret_not_set env={}", settings.app_env)
        return payload_bytes

    if not x_tdb_signature:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-TDB-Signature sarlavhasi talab qilinadi",
        )

    expected = compute_sms_webhook_signature(payload_bytes, secret)
    received = _normalize_signature(x_tdb_signature)
    if not hmac.compare_digest(expected, received):
        logger.warning("tdb_webhook_hmac_rejected")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Xavfsizlik tekshiruvidan o'tmadi. Soxta so'rov!",
        )
    return payload_bytes


class PaymentWebhookError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


class PaymentWebhookService:
    def __init__(self, session: AsyncSession, settings: Settings | None = None) -> None:
        self._session = session
        self._settings = settings or get_settings()
        self._repo = TopdmbozorRepository(session)

    async def process_sms(self, message: str) -> SmsWebhookResponse:
        parsed = parse_click_p2p_sms(message)
        if not parsed:
            return SmsWebhookResponse(ok=False, detail="SMS dan id_ yoki summa aniqlanmadi")

        order = await self._repo.get_order_for_update(parsed.order_id)
        if not order:
            return SmsWebhookResponse(ok=False, detail="Buyurtma topilmadi")

        if order.status == TdbOrderStatus.paid:
            return SmsWebhookResponse(
                ok=True,
                order_id=order.id,
                matched_amount=parsed.amount_uzs,
                detail="Allaqachon to'langan",
            )

        if order.status == TdbOrderStatus.canceled:
            return SmsWebhookResponse(ok=False, detail="Buyurtma bekor qilingan")

        if int(order.amount) != int(parsed.amount_uzs):
            logger.warning(
                "tdb_payment_amount_mismatch order_id={} expected={} got={}",
                order.id,
                order.amount,
                parsed.amount_uzs,
            )
            return SmsWebhookResponse(
                ok=False,
                order_id=order.id,
                matched_amount=parsed.amount_uzs,
                detail=f"Summa mos emas: kutilgan {order.amount} UZS",
            )

        merchant = await self._repo.get_merchant_for_update(order.merchant_id)
        if not merchant:
            return SmsWebhookResponse(ok=False, detail="Merchant topilmadi")

        order.status = TdbOrderStatus.paid
        order.paid_at = datetime.now(timezone.utc)
        await self._repo.credit_merchant_frozen(merchant, int(order.amount))
        await self._session.commit()

        await notify_merchant_order_paid(
            merchant_id=merchant.id,
            order_id=order.id,
            amount_uzs=int(order.amount),
        )

        logger.info("tdb_order_paid order_id={} amount={}", order.id, order.amount)
        return SmsWebhookResponse(
            ok=True,
            order_id=order.id,
            matched_amount=parsed.amount_uzs,
            detail="To'lov tasdiqlandi, frozen_balance yangilandi",
        )
