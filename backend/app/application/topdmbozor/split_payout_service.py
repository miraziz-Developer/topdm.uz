from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.topdmbozor.notifications import notify_merchant_order_completed
from app.core.config import Settings, get_settings
from app.infrastructure.repositories.topdmbozor_repo import TopdmbozorRepository
from app.infrastructure.topdmbozor.p2p_provider_client import P2pProviderClient
from app.models.topdmbozor import TdbDeliveryStatus, TdbOrderStatus


@dataclass(frozen=True, slots=True)
class SplitBreakdown:
    total_amount: int
    bts_fee: int
    platform_commission: int
    merchant_share: int


class SplitPayoutService:
    def __init__(self, session: AsyncSession, settings: Settings | None = None) -> None:
        self._session = session
        self._settings = settings or get_settings()
        self._repo = TopdmbozorRepository(session)
        self._p2p = P2pProviderClient(self._settings)

    def compute_split(self, total_amount: int) -> SplitBreakdown:
        total = int(total_amount)
        bts_fee = int(self._settings.tdb_bts_fee_uzs)
        rate = float(self._settings.tdb_platform_commission_pct)
        commission = int(total * rate / 100)
        merchant_share = total - bts_fee - commission
        if merchant_share < 0:
            raise ValueError("merchant_share_negative")
        return SplitBreakdown(
            total_amount=total,
            bts_fee=bts_fee,
            platform_commission=commission,
            merchant_share=merchant_share,
        )

    async def complete_delivered_order(self, order_id) -> bool:
        from uuid import UUID

        oid = order_id if isinstance(order_id, UUID) else UUID(str(order_id))
        order = await self._repo.get_order_for_update(oid)
        if not order:
            return False
        if order.status == TdbOrderStatus.completed:
            return True
        if order.status != TdbOrderStatus.paid:
            return False
        if order.delivery_status != TdbDeliveryStatus.shipped:
            return False

        merchant = await self._repo.get_merchant_for_update(order.merchant_id)
        if not merchant:
            return False

        split = self.compute_split(int(order.amount))

        order.status = TdbOrderStatus.completed
        order.delivery_status = TdbDeliveryStatus.delivered
        order.completed_at = datetime.now(timezone.utc)

        await self._repo.finalize_paid_order_split(
            merchant,
            order_amount_uzs=int(order.amount),
            merchant_share_uzs=split.merchant_share,
        )
        await self._session.commit()

        bts_card = (self._settings.tdb_bts_payout_card_number or "").strip()
        try:
            await self._p2p.transfer(
                to_card=merchant.card_number,
                amount_uzs=split.merchant_share,
                purpose=f"order_{order.id}_merchant",
            )
            if bts_card:
                await self._p2p.transfer(
                    to_card=bts_card,
                    amount_uzs=split.bts_fee,
                    purpose=f"order_{order.id}_bts",
                )
        except Exception:
            logger.exception("tdb_p2p_transfer_failed order_id={}", order.id)
            # Pul merchant balance da qoladi — qo'lda tuzatish

        await notify_merchant_order_completed(
            merchant_id=merchant.id,
            order_id=order.id,
            merchant_share=split.merchant_share,
        )
        logger.info(
            "tdb_order_completed order_id={} merchant_share={} bts_fee={} commission={}",
            order.id,
            split.merchant_share,
            split.bts_fee,
            split.platform_commission,
        )
        return True
