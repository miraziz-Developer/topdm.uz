"""Do'konchilarga to'lov (payout) — batch (reestr) yoki avtomatik (payout API).

batch rejimi (default, self-employed): barcha pending to'lovlar bitta CSV reestrga
yig'iladi, admin uni bank/Click kabinetiga yuklaydi va "to'landi" deb tasdiqlaydi.
auto rejimi (YaTT/MChJ + provayder): gateway orqali har biri avtomatik to'lanadi.
"""
from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.infrastructure.db.models import ShopModel
from app.infrastructure.payouts import get_payout_gateway
from app.infrastructure.repositories.delivery_repo import DeliveryRepository
from app.infrastructure.repositories.finance_repo import FinanceRepository
from app.models.delivery_claim import MerchantPayoutRequestModel

ZERO = Decimal("0.00")


class PayoutError(ValueError):
    """Payout amaliyotidagi biznes xatosi."""


class MerchantPayoutService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._delivery = DeliveryRepository(session)
        self._finance = FinanceRepository(session)
        self._settings = get_settings()
        self._gateway = get_payout_gateway(self._settings)

    @property
    def mode(self) -> str:
        return (self._settings.payout_mode or "batch").strip().lower()

    async def _shop_names(self, shop_ids: list[UUID]) -> dict[UUID, str]:
        if not shop_ids:
            return {}
        rows = await self._session.execute(
            select(ShopModel.id, ShopModel.name).where(ShopModel.id.in_(shop_ids))
        )
        return {r[0]: r[1] for r in rows.all()}

    async def list_pending(self, *, limit: int = 500) -> list[dict[str, Any]]:
        rows = await self._delivery.list_payout_requests(status="pending", limit=limit)
        names = await self._shop_names([r.shop_id for r in rows])
        return [self._serialize(r, shop_name=names.get(r.shop_id)) for r in rows]

    async def summary(self) -> dict[str, Any]:
        rows = await self._delivery.list_payout_requests(status="pending", limit=1000)
        total = sum((Decimal(str(r.amount_uzs)) for r in rows), ZERO)
        return {
            "mode": self.mode,
            "automatic": bool(self._gateway.is_automatic),
            "provider": self._gateway.name,
            "pending_count": len(rows),
            "pending_total_uzs": float(total),
        }

    async def generate_reestr_csv(self) -> str:
        """Ommaviy to'lov uchun CSV reestr (karta;summa;do'kon;payout_id)."""
        rows = await self._delivery.list_payout_requests(status="pending", limit=1000)
        names = await self._shop_names([r.shop_id for r in rows])
        buf = io.StringIO()
        writer = csv.writer(buf, delimiter=";")
        writer.writerow(["card_number", "amount_uzs", "shop_name", "payout_id"])
        for r in rows:
            card = str((r.meta or {}).get("card_number") or "")
            writer.writerow([card, int(Decimal(str(r.amount_uzs))), names.get(r.shop_id, ""), str(r.id)])
        return buf.getvalue()

    async def complete_payout(self, payout_id: UUID, *, reference: str | None = None) -> dict[str, Any]:
        row = await self._delivery.get_payout_for_update(payout_id)
        if not row:
            raise PayoutError("payout_not_found")
        if row.status not in ("pending", "approved"):
            raise PayoutError("invalid_payout_status")
        try:
            await self._finance.debit_frozen_balance(row.shop_id, Decimal(str(row.amount_uzs)))
        except ValueError as exc:
            raise PayoutError(str(exc)) from exc
        row.status = "completed"
        row.reference = reference or row.reference
        row.processed_at = datetime.now(timezone.utc)
        await self._session.commit()
        return self._serialize(row)

    async def cancel_payout(self, payout_id: UUID, *, note: str | None = None) -> dict[str, Any]:
        row = await self._delivery.get_payout_for_update(payout_id)
        if not row:
            raise PayoutError("payout_not_found")
        if row.status != "pending":
            raise PayoutError("invalid_payout_status")
        try:
            await self._finance.release_frozen_to_current(row.shop_id, Decimal(str(row.amount_uzs)))
        except ValueError as exc:
            raise PayoutError(str(exc)) from exc
        row.status = "rejected"
        row.processed_at = datetime.now(timezone.utc)
        if note:
            meta = dict(row.meta or {})
            meta["reject_reason"] = note
            row.meta = meta
        await self._session.commit()
        return self._serialize(row)

    async def complete_all_pending(self, *, reference: str | None = None) -> dict[str, Any]:
        """Reestr yuklab to'lagandan keyin barcha pendinglarni completed qiladi."""
        rows = await self._delivery.list_payout_requests(status="pending", limit=1000)
        done = 0
        failed: list[str] = []
        for r in rows:
            try:
                await self._finance.debit_frozen_balance(r.shop_id, Decimal(str(r.amount_uzs)))
                r.status = "completed"
                r.reference = reference or r.reference
                r.processed_at = datetime.now(timezone.utc)
                done += 1
            except ValueError:
                failed.append(str(r.id))
        await self._session.commit()
        return {"completed": done, "failed": failed}

    async def process_auto(self) -> dict[str, Any]:
        """auto rejimida: har bir pendingni payout API orqali to'laydi."""
        if not self._gateway.is_automatic:
            return {"skipped": "not_automatic_mode", "completed": 0}
        rows = await self._delivery.list_payout_requests(status="pending", limit=500)
        completed = 0
        failed: list[str] = []
        for r in rows:
            card = str((r.meta or {}).get("card_number") or "")
            if not card:
                failed.append(str(r.id))
                continue
            result = await self._gateway.send_payout(
                payout_id=r.id, card_number=card, amount_uzs=Decimal(str(r.amount_uzs))
            )
            if result.status == "completed":
                try:
                    await self._finance.debit_frozen_balance(r.shop_id, Decimal(str(r.amount_uzs)))
                except ValueError:
                    failed.append(str(r.id))
                    continue
                r.status = "completed"
                r.reference = result.reference or r.reference
                r.processed_at = datetime.now(timezone.utc)
                completed += 1
            else:
                failed.append(str(r.id))
                logger.bind(payout_id=str(r.id)).warning("auto payout not completed: {}", result.status)
        await self._session.commit()
        return {"completed": completed, "failed": failed}

    @staticmethod
    def _serialize(row: MerchantPayoutRequestModel, *, shop_name: str | None = None) -> dict[str, Any]:
        return {
            "id": str(row.id),
            "shop_id": str(row.shop_id),
            "shop_name": shop_name,
            "amount_uzs": float(row.amount_uzs),
            "status": row.status,
            "destination": row.destination,
            "card_number": str((row.meta or {}).get("card_number") or ""),
            "reference": row.reference,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "processed_at": row.processed_at.isoformat() if row.processed_at else None,
        }
