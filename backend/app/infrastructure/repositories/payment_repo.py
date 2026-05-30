from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payments import CoinPackageModel, PaymentTransactionModel


class PaymentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_coin_package(self, package_id: UUID) -> CoinPackageModel | None:
        stmt = select(CoinPackageModel).where(
            CoinPackageModel.id == package_id,
            CoinPackageModel.is_active.is_(True),
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_coin_packages(self) -> list[CoinPackageModel]:
        stmt = (
            select(CoinPackageModel)
            .where(CoinPackageModel.is_active.is_(True))
            .order_by(CoinPackageModel.sort_order.asc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_transaction(self, tx_id: UUID) -> PaymentTransactionModel | None:
        return await self._session.get(PaymentTransactionModel, tx_id)

    async def get_transaction_for_update(self, tx_id: UUID) -> PaymentTransactionModel | None:
        stmt = select(PaymentTransactionModel).where(PaymentTransactionModel.id == tx_id).with_for_update()
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_provider_trans_id(self, provider_trans_id: str) -> PaymentTransactionModel | None:
        stmt = select(PaymentTransactionModel).where(PaymentTransactionModel.provider_trans_id == provider_trans_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_provider_trans_id_for_update(
        self,
        *,
        provider: str,
        provider_trans_id: str,
    ) -> PaymentTransactionModel | None:
        stmt = (
            select(PaymentTransactionModel)
            .where(
                PaymentTransactionModel.provider == provider,
                PaymentTransactionModel.provider_trans_id == provider_trans_id,
            )
            .with_for_update()
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_transaction(
        self,
        *,
        shop_id: UUID,
        coin_package_id: UUID,
        amount_uzs: Decimal,
        coins_added: int,
        provider: str,
        checkout_url: str | None = None,
    ) -> PaymentTransactionModel:
        tx = PaymentTransactionModel(
            shop_id=shop_id,
            coin_package_id=coin_package_id,
            amount_uzs=amount_uzs,
            coins_added=coins_added,
            provider=provider,
            status="pending",
            checkout_url=checkout_url,
        )
        self._session.add(tx)
        await self._session.flush()
        return tx

    async def mark_success(
        self,
        tx: PaymentTransactionModel,
        *,
        provider_trans_id: str,
    ) -> PaymentTransactionModel:
        tx.status = "success"
        tx.provider_trans_id = provider_trans_id
        tx.updated_at = datetime.now(timezone.utc)
        await self._session.flush()
        return tx

    async def mark_failed(self, tx: PaymentTransactionModel) -> PaymentTransactionModel:
        tx.status = "failed"
        tx.updated_at = datetime.now(timezone.utc)
        await self._session.flush()
        return tx
