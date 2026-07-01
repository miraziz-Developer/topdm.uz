from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import ShopModel
from app.models.merchant_support import (
    MerchantSupportCategory,
    MerchantSupportStatus,
    MerchantSupportTicketModel,
)

_CATEGORY_LABELS = {
    MerchantSupportCategory.PROBLEM.value: "Muammo",
    MerchantSupportCategory.SUGGESTION.value: "Taklif",
    MerchantSupportCategory.QUESTION.value: "Savol",
}

_STATUS_LABELS = {
    MerchantSupportStatus.OPEN.value: "Yangi",
    MerchantSupportStatus.IN_PROGRESS.value: "Ko'rib chiqilmoqda",
    MerchantSupportStatus.RESOLVED.value: "Hal qilindi",
    MerchantSupportStatus.CLOSED.value: "Yopildi",
}


def _ticket_dict(row: MerchantSupportTicketModel, *, shop_name: str | None = None) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "shop_id": str(row.shop_id),
        "shop_name": shop_name,
        "category": row.category,
        "category_label": _CATEGORY_LABELS.get(row.category, row.category),
        "message": row.message,
        "status": row.status,
        "status_label": _STATUS_LABELS.get(row.status, row.status),
        "admin_note": row.admin_note,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


class MerchantSupportService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_ticket(
        self,
        shop: ShopModel,
        *,
        category: str,
        message: str,
        merchant_phone: str | None = None,
        merchant_email: str | None = None,
    ) -> dict[str, Any]:
        cat = category.strip().lower()
        if cat not in {c.value for c in MerchantSupportCategory}:
            raise ValueError("Noto'g'ri kategoriya")
        text = message.strip()
        if len(text) < 5:
            raise ValueError("Xabar juda qisqa (kamida 5 belgi)")
        if len(text) > 4000:
            raise ValueError("Xabar juda uzun")

        row = MerchantSupportTicketModel(
            shop_id=shop.id,
            merchant_phone=merchant_phone,
            merchant_email=merchant_email,
            category=cat,
            message=text,
            status=MerchantSupportStatus.OPEN.value,
        )
        self.session.add(row)
        await self.session.flush()
        await self.session.commit()
        return _ticket_dict(row, shop_name=shop.name)

    async def list_for_shop(self, shop_id: uuid.UUID, *, limit: int = 50) -> list[dict[str, Any]]:
        result = await self.session.execute(
            select(MerchantSupportTicketModel)
            .where(MerchantSupportTicketModel.shop_id == shop_id)
            .order_by(MerchantSupportTicketModel.created_at.desc())
            .limit(limit)
        )
        return [_ticket_dict(row) for row in result.scalars().all()]
