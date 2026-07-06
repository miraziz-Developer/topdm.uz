"""Do'kon ro'yxatdan o'tish — admin qo'lda tasdiqlash / rad etish."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import ShopModel

PENDING_STATUSES = ("pending_review", "pending_ai")


class ShopModerationError(ValueError):
    pass


class AdminShopModerationService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_pending(self, *, limit: int = 50) -> list[ShopModel]:
        result = await self._session.execute(
            select(ShopModel)
            .where(
                ShopModel.is_active.is_(True),
                ShopModel.is_verified.is_(False),
                ShopModel.verification_status.in_(PENDING_STATUSES),
            )
            .order_by(ShopModel.name.asc())
            .limit(min(limit, 200))
        )
        return list(result.scalars().all())

    async def get_shop(self, shop_id: UUID) -> ShopModel | None:
        return await self._session.get(ShopModel, shop_id)

    async def approve(self, shop_id: UUID, *, note: str | None = None) -> ShopModel:
        shop = await self._require_pending(shop_id)
        now = datetime.now(timezone.utc)
        shop.is_verified = True
        shop.verification_status = "approved"
        shop.verification_reason = (note or "").strip() or None
        shop.ai_reviewed_at = now
        metrics = dict(shop.trust_metrics or {})
        metrics["manual_review"] = {
            "status": "approved",
            "at": now.isoformat(),
            "note": note,
        }
        shop.trust_metrics = metrics
        await self._session.commit()
        await self._session.refresh(shop)
        await self._notify_shop(shop, approved=True, reason=note)
        return shop

    async def reject(self, shop_id: UUID, *, reason: str) -> ShopModel:
        reason = (reason or "").strip() or "Moderator talablariga mos emas."
        shop = await self._require_pending(shop_id)
        now = datetime.now(timezone.utc)
        shop.is_verified = False
        shop.verification_status = "rejected"
        shop.verification_reason = reason
        shop.ai_reviewed_at = now
        metrics = dict(shop.trust_metrics or {})
        metrics["manual_review"] = {
            "status": "rejected",
            "at": now.isoformat(),
            "reason": reason,
        }
        shop.trust_metrics = metrics
        await self._session.commit()
        await self._session.refresh(shop)
        await self._notify_shop(shop, approved=False, reason=reason)
        return shop

    async def dashboard_counts(self) -> dict[str, int]:
        from app.models.delivery_claim import MerchantPayoutRequestModel
        from app.models.merchant_support import MerchantSupportTicketModel

        pending_shops = await self._session.execute(
            select(ShopModel.id).where(
                ShopModel.is_active.is_(True),
                ShopModel.is_verified.is_(False),
                ShopModel.verification_status.in_(PENDING_STATUSES),
            )
        )
        pending_payouts = await self._session.execute(
            select(MerchantPayoutRequestModel.id).where(MerchantPayoutRequestModel.status == "pending")
        )
        open_tickets = await self._session.execute(
            select(MerchantSupportTicketModel.id).where(
                MerchantSupportTicketModel.status.in_(("open", "new", "pending"))
            )
        )
        return {
            "pending_shops": len(pending_shops.scalars().all()),
            "pending_payouts": len(pending_payouts.scalars().all()),
            "open_support_tickets": len(open_tickets.scalars().all()),
        }

    async def _require_pending(self, shop_id: UUID) -> ShopModel:
        shop = await self._session.get(ShopModel, shop_id)
        if not shop:
            raise ShopModerationError("shop_not_found")
        if shop.is_verified and shop.verification_status == "approved":
            raise ShopModerationError("shop_already_approved")
        return shop

    async def _notify_shop(self, shop: ShopModel, *, approved: bool, reason: str | None) -> None:
        chat_id = shop.telegram_chat_id
        if not chat_id:
            return
        try:
            from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway

            gateway = TelegramNotifierGateway()
            if approved:
                text = (
                    f"✅ «{shop.name}» platforma moderatori tomonidan tasdiqlandi!\n\n"
                    "Endi mahsulotlaringiz saytda ko'rinadi. CRM va botdan foydalaning."
                )
            else:
                text = (
                    f"❌ «{shop.name}» arizasi rad etildi.\n\n"
                    f"Sabab: {reason or '—'}\n\n"
                    "Ma'lumotlarni tuzatib, qayta murojaat qiling yoki @Bozorliiicrm_bot orqali yozing."
                )
            await gateway.send_message(chat_id=int(chat_id), text=text)
        except Exception as exc:
            logger.warning("shop_moderation_notify_failed", shop_id=str(shop.id), error=str(exc)[:200])
