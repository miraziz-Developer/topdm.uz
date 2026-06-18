"""Batch (reestr) payout — self-employed uchun default rejim.

Bu gateway pulni o'zi jo'natmaydi. Admin barcha pending to'lovlarni bitta
reestr (CSV) fayliga yig'adi, uni Click Business / bank kabinetiga "ommaviy
to'lov" sifatida yuklaydi, so'ng panelda "to'landi" deb tasdiqlaydi.
"""
from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from app.domain.interfaces.payout_gateway import PayoutResult


class BatchPayoutGateway:
    name = "batch"
    is_automatic = False

    async def send_payout(
        self,
        *,
        payout_id: UUID,
        card_number: str,
        amount_uzs: Decimal,
        note: str | None = None,
    ) -> PayoutResult:
        # Batch rejimida pul API orqali yuborilmaydi — reestrga qo'shiladi.
        return PayoutResult(status="queued", reference=None, raw={"mode": "batch"})
