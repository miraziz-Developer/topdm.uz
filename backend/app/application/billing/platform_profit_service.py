"""Platforma foydasini (komissiya) shaxsiy kartaga ko'chirish — profit sweep ledger.

Muhim qoida: faqat YETKAZILGAN (released) buyurtmalar komissiyasi yechib olinadi.
Escrow'da turgan (held_in_escrow) yoki refund qilingan pul hech qachon tegilmaydi —
do'konchilar puli har doim kafolatlangan bo'ladi.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.repositories.finance_repo import FinanceRepository
from app.models.finance import PlatformProfitSweepModel, PlatformProfitSweepStatus

ZERO = Decimal("0.00")


def _q(value: Decimal) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"))


class PlatformProfitError(ValueError):
    """Foyda sweep amaliyotidagi biznes xatosi."""


class PlatformProfitService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = FinanceRepository(session)

    async def _compute(self) -> dict[str, Decimal]:
        released = _q(await self._repo.released_commission_total())
        totals = await self._repo.profit_sweep_totals()
        pending = _q(totals[PlatformProfitSweepStatus.PENDING.value])
        completed = _q(totals[PlatformProfitSweepStatus.COMPLETED.value])
        withdrawable = _q(released - pending - completed)
        if withdrawable < ZERO:
            withdrawable = ZERO
        return {
            "earned_released": released,
            "pending": pending,
            "completed": completed,
            "withdrawable": withdrawable,
        }

    async def summary(self) -> dict[str, Any]:
        c = await self._compute()
        return {
            "earned_profit_uzs": float(c["earned_released"]),
            "swept_pending_uzs": float(c["pending"]),
            "swept_completed_uzs": float(c["completed"]),
            "withdrawable_uzs": float(c["withdrawable"]),
            "note": "Faqat yetkazilgan buyurtmalar komissiyasi. Escrow (do'konchilar puli) hisobga olinmaydi.",
        }

    async def create_sweep(self, *, amount_uzs: Decimal, note: str | None = None) -> dict[str, Any]:
        amount = _q(amount_uzs)
        if amount <= ZERO:
            raise PlatformProfitError("invalid_amount")

        c = await self._compute()
        if amount > c["withdrawable"]:
            raise PlatformProfitError("amount_exceeds_withdrawable")

        row = await self._repo.create_profit_sweep(amount=amount, note=note)
        await self._session.commit()
        return self._serialize(row, withdrawable_after=_q(c["withdrawable"] - amount))

    async def complete_sweep(
        self, sweep_id: UUID, *, reference: str | None = None, note: str | None = None
    ) -> dict[str, Any]:
        row = await self._repo.get_profit_sweep_for_update(sweep_id)
        if not row:
            raise PlatformProfitError("sweep_not_found")
        if row.status != PlatformProfitSweepStatus.PENDING.value:
            raise PlatformProfitError("sweep_not_pending")
        row.status = PlatformProfitSweepStatus.COMPLETED.value
        row.reference = reference or row.reference
        row.processed_at = datetime.now(timezone.utc)
        if note:
            meta = dict(row.meta or {})
            meta["note"] = note
            row.meta = meta
        await self._session.commit()
        return self._serialize(row)

    async def cancel_sweep(self, sweep_id: UUID, *, note: str | None = None) -> dict[str, Any]:
        row = await self._repo.get_profit_sweep_for_update(sweep_id)
        if not row:
            raise PlatformProfitError("sweep_not_found")
        if row.status != PlatformProfitSweepStatus.PENDING.value:
            raise PlatformProfitError("sweep_not_pending")
        row.status = PlatformProfitSweepStatus.CANCELLED.value
        row.processed_at = datetime.now(timezone.utc)
        if note:
            meta = dict(row.meta or {})
            meta["cancel_note"] = note
            row.meta = meta
        await self._session.commit()
        return self._serialize(row)

    async def list_sweeps(self, *, limit: int = 50) -> dict[str, Any]:
        rows = await self._repo.list_profit_sweeps(limit=limit)
        return {"items": [self._serialize(r) for r in rows]}

    @staticmethod
    def _serialize(row: PlatformProfitSweepModel, *, withdrawable_after: Decimal | None = None) -> dict[str, Any]:
        out = {
            "id": str(row.id),
            "amount_uzs": float(row.amount_uzs),
            "status": row.status,
            "destination": row.destination,
            "reference": row.reference,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "processed_at": row.processed_at.isoformat() if row.processed_at else None,
        }
        if withdrawable_after is not None:
            out["withdrawable_after_uzs"] = float(withdrawable_after)
        return out
