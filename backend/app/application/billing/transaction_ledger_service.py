from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import ShopModel
from app.models.transaction_ledger import TransactionLedgerModel


class TransactionLedgerService:
    """Immutable ledger entries with atomic shop balance updates."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def append_entry(
        self,
        *,
        shop_id: UUID,
        entry_type: str,
        category: str,
        amount_uzs: int,
        idempotency_key: str,
        reference_type: str | None = None,
        reference_id: UUID | None = None,
        meta: dict | None = None,
    ) -> TransactionLedgerModel:
        existing_row = await self._session.execute(
            select(TransactionLedgerModel).where(TransactionLedgerModel.idempotency_key == idempotency_key)
        )
        prior = existing_row.scalar_one_or_none()
        if prior is not None:
            return prior

        shop_result = await self._session.execute(
            select(ShopModel).where(ShopModel.id == shop_id).with_for_update()
        )
        shop = shop_result.scalar_one_or_none()
        if shop is None:
            raise ValueError("shop_not_found")

        amount = int(amount_uzs)
        if amount <= 0:
            raise ValueError("invalid_amount")

        current = int(shop.debt_balance or 0)
        if entry_type == "debit":
            new_balance = current + amount
        elif entry_type == "credit":
            new_balance = max(0, current - amount)
        else:
            raise ValueError("invalid_entry_type")

        shop.debt_balance = new_balance
        row = TransactionLedgerModel(
            shop_id=shop_id,
            entry_type=entry_type,
            category=category,
            amount_uzs=amount,
            balance_after_uzs=new_balance,
            reference_type=reference_type,
            reference_id=reference_id,
            idempotency_key=idempotency_key,
            meta=meta or {},
        )
        self._session.add(row)
        await self._session.flush()
        return row
