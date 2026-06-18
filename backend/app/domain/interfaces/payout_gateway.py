"""Do'konchilarga to'lov (payout/disbursement) gateway interfeysi.

Maqsad: bugun "batch" (reestr + qo'lda tasdiq, self-employed uchun) ishlatamiz,
keyinroq YaTT/MChJ + provayder (Multicard/Uzum/ATMOS) shartnomasi bo'lganda
faqat adapterni almashtirib, to'liq avtomatik payoutga o'tamiz — kodni qayta
yozmasdan.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Protocol, runtime_checkable
from uuid import UUID


@dataclass(slots=True)
class PayoutResult:
    status: str  # "completed" | "pending" | "queued" | "failed"
    reference: str | None = None
    error: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


@runtime_checkable
class PayoutGateway(Protocol):
    """Bitta do'konchi kartasiga pul jo'natish abstraktsiyasi."""

    name: str
    is_automatic: bool

    async def send_payout(
        self,
        *,
        payout_id: UUID,
        card_number: str,
        amount_uzs: Decimal,
        note: str | None = None,
    ) -> PayoutResult:
        ...
