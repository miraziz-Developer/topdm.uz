from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload

from app.infrastructure.db.models import OrderModel, ShopModel
from app.models.finance import (
    MerchantFinanceWalletModel,
    PlatformTransactionModel,
    PlatformTransactionStatus,
)

ZERO = Decimal("0.00")


class FinanceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_order_for_update(self, order_id: UUID) -> OrderModel | None:
        stmt = (
            select(OrderModel)
            .options(noload(OrderModel.product), noload(OrderModel.shop))
            .where(OrderModel.id == order_id)
            .with_for_update()
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_shop(self, shop_id: UUID) -> ShopModel | None:
        return await self._session.get(ShopModel, shop_id)

    async def get_wallet_for_update(self, shop_id: UUID) -> MerchantFinanceWalletModel:
        stmt = (
            select(MerchantFinanceWalletModel)
            .options(noload(MerchantFinanceWalletModel.shop))
            .where(MerchantFinanceWalletModel.shop_id == shop_id)
            .with_for_update()
        )
        result = await self._session.execute(stmt)
        wallet = result.scalar_one_or_none()
        if wallet:
            return wallet
        wallet = MerchantFinanceWalletModel(shop_id=shop_id, current_balance=ZERO, frozen_balance=ZERO)
        self._session.add(wallet)
        await self._session.flush()
        return wallet

    async def get_transaction_by_order(self, order_id: UUID) -> PlatformTransactionModel | None:
        stmt = select(PlatformTransactionModel).where(PlatformTransactionModel.order_id == order_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_transaction_by_order_for_update(self, order_id: UUID) -> PlatformTransactionModel | None:
        stmt = (
            select(PlatformTransactionModel)
            .options(noload(PlatformTransactionModel.order), noload(PlatformTransactionModel.shop))
            .where(PlatformTransactionModel.order_id == order_id)
            .with_for_update()
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_transaction_by_idempotency(self, key: str) -> PlatformTransactionModel | None:
        stmt = select(PlatformTransactionModel).where(PlatformTransactionModel.idempotency_key == key)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_platform_transaction(
        self,
        *,
        order_id: UUID,
        shop_id: UUID,
        total_amount_received: Decimal,
        product_subtotal: Decimal,
        merchant_share: Decimal,
        delivery_share: Decimal,
        platform_commission: Decimal,
        gateway_provider: str | None,
        gateway_reference: str | None,
        idempotency_key: str | None,
        billing_snapshot: dict,
    ) -> PlatformTransactionModel:
        tx = PlatformTransactionModel(
            order_id=order_id,
            shop_id=shop_id,
            total_amount_received=total_amount_received,
            product_subtotal=product_subtotal,
            merchant_share=merchant_share,
            delivery_share=delivery_share,
            platform_commission=platform_commission,
            status=PlatformTransactionStatus.HELD_IN_ESCROW.value,
            gateway_provider=gateway_provider,
            gateway_reference=gateway_reference,
            idempotency_key=idempotency_key,
            billing_snapshot=billing_snapshot,
        )
        self._session.add(tx)
        await self._session.flush()
        return tx

    async def credit_frozen_balance(self, shop_id: UUID, amount: Decimal) -> MerchantFinanceWalletModel:
        wallet = await self.get_wallet_for_update(shop_id)
        wallet.frozen_balance = (wallet.frozen_balance or ZERO) + amount
        return wallet

    async def release_frozen_to_current(self, shop_id: UUID, amount: Decimal) -> MerchantFinanceWalletModel:
        wallet = await self.get_wallet_for_update(shop_id)
        frozen = wallet.frozen_balance or ZERO
        if frozen < amount:
            raise ValueError("insufficient_frozen_balance")
        wallet.frozen_balance = frozen - amount
        wallet.current_balance = (wallet.current_balance or ZERO) + amount
        return wallet

    async def debit_frozen_balance(self, shop_id: UUID, amount: Decimal) -> MerchantFinanceWalletModel:
        wallet = await self.get_wallet_for_update(shop_id)
        frozen = wallet.frozen_balance or ZERO
        if frozen < amount:
            raise ValueError("insufficient_frozen_balance")
        wallet.frozen_balance = frozen - amount
        return wallet

    async def mark_transaction_released(self, tx: PlatformTransactionModel) -> None:
        tx.status = PlatformTransactionStatus.RELEASED_TO_MERCHANT.value
        tx.released_at = datetime.now(timezone.utc)

    async def mark_transaction_refunded(self, tx: PlatformTransactionModel) -> None:
        tx.status = PlatformTransactionStatus.REFUNDED.value
        tx.refunded_at = datetime.now(timezone.utc)
