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

    async def attach_yandex_claim(
        self,
        row: DeliveryClaimModel,
        *,
        yandex_claim_id: str,
        yandex_revision: str | None,
        status: str,
        meta_patch: dict | None = None,
    ) -> DeliveryClaimModel:
        row.yandex_claim_id = yandex_claim_id
        row.yandex_revision = yandex_revision
        row.status = status
        if meta_patch:
            row.meta = {**(row.meta or {}), **meta_patch}
        row.updated_at = datetime.now(timezone.utc)
        await self._session.flush()
        return row

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
    ) -> MerchantPayoutRequestModel:
        row = MerchantPayoutRequestModel(
            shop_id=shop_id,
            amount_uzs=amount_uzs,
            destination=destination,
            status="pending",
        )
        self._session.add(row)
        await self._session.flush()
        return row
