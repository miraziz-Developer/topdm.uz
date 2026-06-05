from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.base import Base


class OrderCheckoutPaymentModel(Base):
    """Customer order checkout session (Click / Payme) — separate from coin top-ups."""

    __tablename__ = "order_checkout_payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    amount_uzs: Mapped[int] = mapped_column(Integer, nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)
    provider_trans_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    customer_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    purpose: Mapped[str] = mapped_column(String(32), nullable=False, default="order", server_default="order", index=True)
    shop_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    meta: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
