"""Mijozga tashqi kanal orqali xabar: Telegram (ro'yxatdan o'tgan) yoki email. SMS keyinroq."""
from __future__ import annotations

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.marketplace.customer_order_notifications import CUSTOMER_STATUS_MESSAGES
from app.core.config import Settings, get_settings
from app.core.phone import normalize_uz_phone_e164
from app.infrastructure.auth.user_repo import UserAuthRepository
from app.infrastructure.db.models import AppUserModel, OrderModel
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway
from app.infrastructure.messaging.resend_email import ResendEmailGateway

OUTBOUND_STATUSES = frozenset({"confirmed", "preparing", "ready", "completed", "cancelled"})


class CustomerOutboundNotifyService:
    def __init__(self, session: AsyncSession, settings: Settings | None = None) -> None:
        self._session = session
        self._settings = settings or get_settings()
        self._users = UserAuthRepository(session)
        self._email = ResendEmailGateway()
        self._telegram = TelegramNotifierGateway(self._settings.telegram_bot_token)

    async def notify_order_status(
        self,
        *,
        order: OrderModel,
        product_name: str,
        new_status: str,
        prev_status: str | None = None,
    ) -> dict:
        new_status = (new_status or "").lower()
        prev = (prev_status or "").lower()
        if not new_status or new_status == prev or new_status not in OUTBOUND_STATUSES:
            return {"sent": False, "reason": "skipped"}

        tpl = CUSTOMER_STATUS_MESSAGES.get(new_status)
        if not tpl:
            return {"sent": False, "reason": "no_template"}

        title, body = tpl
        user = await self._resolve_user(order)
        order_url = f"{self._settings.site_url.rstrip('/')}/orders/{order.id}"
        if new_status == "ready":
            body = f"{body}\n\nQR kodingiz: {order_url}"

        sent: dict[str, bool] = {"telegram": False, "email": False}

        if user and user.telegram_id:
            try:
                text = (
                    f"{title}\n"
                    f"{product_name[:80]}\n\n"
                    f"{body}\n\n"
                    f"Buyurtma: {order_url}"
                )
                await self._telegram.send_message(int(user.telegram_id), text)
                sent["telegram"] = True
            except Exception:
                logger.exception(
                    "customer_telegram_notify_failed",
                    extra={"order_id": str(order.id), "telegram_id": user.telegram_id},
                )

        email = (user.email if user and user.email else None) or self._email_from_order(order)
        if email:
            try:
                await self._email.send_order_status(
                    to_email=email,
                    title=title,
                    body=body,
                    product_name=product_name,
                    order_url=order_url,
                )
                sent["email"] = True
            except Exception:
                logger.exception(
                    "customer_email_notify_failed",
                    extra={"order_id": str(order.id), "email": email},
                )

        return {"sent": any(sent.values()), "channels": sent}

    async def _resolve_user(self, order: OrderModel) -> AppUserModel | None:
        uid = getattr(order, "customer_user_id", None)
        if uid:
            user = await self._users.get_by_id(uid)
            if user:
                return user

        phone = normalize_uz_phone_e164(order.customer_phone or "")
        if phone:
            result = await self._session.execute(
                select(AppUserModel)
                .where(AppUserModel.phone == phone)
                .order_by(AppUserModel.updated_at.desc())
                .limit(1)
            )
            user = result.scalars().first()
            if user:
                return user

        email = self._email_from_order(order)
        if email:
            return await self._users.get_by_email(email)
        return None

    @staticmethod
    def _email_from_order(order: OrderModel) -> str | None:
        raw = (getattr(order, "customer_email", None) or "").strip().lower()
        return raw or None
