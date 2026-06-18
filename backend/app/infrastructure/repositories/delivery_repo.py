from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.delivery_claim import DeliveryClaimModel, MerchantPayoutRequestModel


class DeliveryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_claim_by_order(self, order_id: UUID) -> DeliveryClaimModel | None:
        stmt = select(DeliveryClaimModel).where(DeliveryClaimModel.order_id == order_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_claim_by_order_for_update(self, order_id: UUID) -> DeliveryClaimModel | None:
        stmt = (
            select(DeliveryClaimModel)
            .where(DeliveryClaimModel.order_id == order_id)
            .with_for_update()
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_claim(
        self,
        *,
        order_id: UUID,
        shop_id: UUID,
        carrier_class: str,
        delivery_cost: Decimal,
        eta_minutes: int | None,
        offer_payload: str | None = None,
        meta: dict | None = None,
    ) -> DeliveryClaimModel:
        row = DeliveryClaimModel(
            order_id=order_id,
            shop_id=shop_id,
            carrier_class=carrier_class,
            delivery_cost=delivery_cost,
            eta_minutes=eta_minutes,
            offer_payload=offer_payload,
            status="draft",
            meta=meta or {},
        )
        self._session.add(row)
        await self._session.flush()
        return row

    async def attach_bts_order(
        self,
        row: DeliveryClaimModel,
        *,
        bts_order_id: str,
        status: str,
        meta_patch: dict | None = None,
    ) -> DeliveryClaimModel:
        """BTS orderId — DB ustuni `yandex_claim_id` (legacy nom)."""
        row.yandex_claim_id = str(bts_order_id)
        row.status = status
        row.accepted_at = datetime.now(timezone.utc)
        if meta_patch:
            row.meta = {**(row.meta or {}), **meta_patch}
        row.updated_at = datetime.now(timezone.utc)
        await self._session.flush()
        return row

    async def list_active_bts_claims(self, *, limit: int = 200) -> list[DeliveryClaimModel]:
        stmt = (
            select(DeliveryClaimModel)
            .where(
                DeliveryClaimModel.yandex_claim_id.isnot(None),
                DeliveryClaimModel.status.notin_(("delivered", "cancelled")),
            )
            .order_by(DeliveryClaimModel.updated_at.asc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def update_claim_status(
        self,
        row: DeliveryClaimModel,
        *,
        status: str,
        accepted: bool = False,
        delivered: bool = False,
    ) -> DeliveryClaimModel:
        row.status = status
        now = datetime.now(timezone.utc)
        if accepted and row.accepted_at is None:
            row.accepted_at = now
        if delivered and row.delivered_at is None:
            row.delivered_at = now
        row.updated_at = now
        await self._session.flush()
        return row

    async def get_wallet_summary(self, shop_id: UUID) -> dict:
        from app.models.finance import MerchantFinanceWalletModel

        wallet = await self._session.get(MerchantFinanceWalletModel, shop_id)
        if not wallet:
            return {
                "current_balance": "0.00",
                "frozen_balance": "0.00",
            }
        return {
            "current_balance": str(wallet.current_balance),
            "frozen_balance": str(wallet.frozen_balance),
        }

    async def create_payout_request(
        self,
        *,
        shop_id: UUID,
        amount_uzs: Decimal,
        destination: str = "bank_card",
        card_number: str | None = None,
    ) -> MerchantPayoutRequestModel:
        meta: dict = {}
        dest = destination
        if card_number:
            digits = "".join(ch for ch in card_number if ch.isdigit())
            meta["card_number"] = digits
            dest = f"card:{digits[:4]}****{digits[-4:]}" if len(digits) == 16 else "bank_card"
        row = MerchantPayoutRequestModel(
            shop_id=shop_id,
            amount_uzs=amount_uzs,
            destination=dest,
            status="pending",
            meta=meta,
        )
        self._session.add(row)
        await self._session.flush()
        return row

    async def list_payout_requests(
        self, *, status: str | None = None, limit: int = 200
    ) -> list[MerchantPayoutRequestModel]:
        stmt = select(MerchantPayoutRequestModel)
        if status:
            stmt = stmt.where(MerchantPayoutRequestModel.status == status)
        stmt = stmt.order_by(MerchantPayoutRequestModel.created_at.asc()).limit(min(limit, 1000))
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_payout_for_update(self, payout_id: UUID) -> MerchantPayoutRequestModel | None:
        stmt = (
            select(MerchantPayoutRequestModel)
            .where(MerchantPayoutRequestModel.id == payout_id)
            .with_for_update()
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()
