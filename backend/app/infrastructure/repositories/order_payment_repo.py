from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order_checkout_payment import OrderCheckoutPaymentModel


class OrderPaymentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_checkout(self, checkout_id: UUID) -> OrderCheckoutPaymentModel | None:
        return await self._session.get(OrderCheckoutPaymentModel, checkout_id)

    async def get_checkout_for_update(self, checkout_id: UUID) -> OrderCheckoutPaymentModel | None:
        stmt = (
            select(OrderCheckoutPaymentModel)
            .where(OrderCheckoutPaymentModel.id == checkout_id)
            .with_for_update()
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_provider_trans_id_for_update(
        self,
        *,
        provider: str,
        provider_trans_id: str,
    ) -> OrderCheckoutPaymentModel | None:
        stmt = (
            select(OrderCheckoutPaymentModel)
            .where(
                OrderCheckoutPaymentModel.provider == provider,
                OrderCheckoutPaymentModel.provider_trans_id == provider_trans_id,
            )
            .with_for_update()
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_pending(
        self,
        *,
        order_ids: list[UUID],
        amount_uzs: int,
        provider: str,
        customer_phone: str | None = None,
        purpose: str = "order",
        shop_id: UUID | None = None,
        meta: dict | None = None,
    ) -> OrderCheckoutPaymentModel:
        row = OrderCheckoutPaymentModel(
            order_ids=[str(oid) for oid in order_ids],
            amount_uzs=int(amount_uzs),
            provider=provider.strip().lower(),
            status="pending",
            customer_phone=customer_phone,
            purpose=purpose,
            shop_id=shop_id,
            meta=meta or {},
        )
        self._session.add(row)
        await self._session.flush()
        return row

    async def mark_success(
        self,
        row: OrderCheckoutPaymentModel,
        *,
        provider_trans_id: str,
    ) -> OrderCheckoutPaymentModel:
        row.status = "success"
        row.provider_trans_id = provider_trans_id
        row.paid_at = datetime.now(timezone.utc)
        await self._session.flush()
        return row

    async def mark_failed(self, row: OrderCheckoutPaymentModel) -> OrderCheckoutPaymentModel:
        row.status = "failed"
        await self._session.flush()
        return row

    async def find_latest_for_order(self, order_id: UUID) -> OrderCheckoutPaymentModel | None:
        oid = str(order_id)
        stmt = (
            select(OrderCheckoutPaymentModel)
            .where(OrderCheckoutPaymentModel.order_ids.contains([oid]))
            .order_by(OrderCheckoutPaymentModel.created_at.desc())
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()
