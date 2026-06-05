from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.topdmbozor import TdbDeliveryStatus, TdbMerchant, TdbOrder, TdbOrderStatus, TdbUser


class TopdmbozorRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_or_create_user(self, *, phone_number: str, username: str | None) -> TdbUser:
        stmt = select(TdbUser).where(TdbUser.phone_number == phone_number)
        row = (await self._session.execute(stmt)).scalar_one_or_none()
        if row:
            if username and not row.username:
                row.username = username
            return row
        user = TdbUser(phone_number=phone_number, username=username)
        self._session.add(user)
        await self._session.flush()
        return user

    async def get_merchant(self, merchant_id: UUID) -> TdbMerchant | None:
        return await self._session.get(TdbMerchant, merchant_id)

    async def get_merchant_for_update(self, merchant_id: UUID) -> TdbMerchant | None:
        stmt = select(TdbMerchant).where(TdbMerchant.id == merchant_id).with_for_update()
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def get_order(self, order_id: UUID) -> TdbOrder | None:
        return await self._session.get(TdbOrder, order_id)

    async def get_order_for_update(self, order_id: UUID) -> TdbOrder | None:
        stmt = select(TdbOrder).where(TdbOrder.id == order_id).with_for_update()
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def create_order(
        self,
        *,
        user_id: UUID,
        merchant_id: UUID,
        amount: int,
        click_p2p_url: str,
    ) -> TdbOrder:
        order = TdbOrder(
            user_id=user_id,
            merchant_id=merchant_id,
            amount=int(amount),
            status=TdbOrderStatus.pending,
            delivery_status=TdbDeliveryStatus.pending,
            click_p2p_url=click_p2p_url,
        )
        self._session.add(order)
        await self._session.flush()
        return order

    async def list_shipped_orders(self, *, limit: int = 200) -> list[TdbOrder]:
        stmt = (
            select(TdbOrder)
            .where(
                TdbOrder.delivery_status == TdbDeliveryStatus.shipped,
                TdbOrder.status == TdbOrderStatus.paid,
            )
            .order_by(TdbOrder.created_at.asc())
            .limit(limit)
        )
        return list((await self._session.execute(stmt)).scalars().all())

    async def credit_merchant_frozen(self, merchant: TdbMerchant, amount_uzs: int) -> None:
        merchant.frozen_balance = Decimal(merchant.frozen_balance) + Decimal(int(amount_uzs))

    async def finalize_paid_order_split(
        self,
        merchant: TdbMerchant,
        *,
        order_amount_uzs: int,
        merchant_share_uzs: int,
    ) -> None:
        """To'liq summa frozen dan chiqariladi; merchant_share → balance."""
        total = Decimal(int(order_amount_uzs))
        share = Decimal(int(merchant_share_uzs))
        frozen = Decimal(merchant.frozen_balance)
        if frozen < total:
            raise ValueError("insufficient_frozen_balance")
        merchant.frozen_balance = frozen - total
        merchant.balance = Decimal(merchant.balance) + share

    async def create_merchant(
        self,
        *,
        shop_name: str,
        card_number: str,
        user_id: UUID | None,
    ) -> TdbMerchant:
        m = TdbMerchant(
            shop_name=shop_name,
            card_number=card_number.replace(" ", ""),
            user_id=user_id,
            is_active=True,
        )
        self._session.add(m)
        await self._session.flush()
        return m
