from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.base import Base


class CarrierClass(str, enum.Enum):
    EXPRESS = "express"
    CARGO = "cargo"


class DeliveryClaimStatus(str, enum.Enum):
    DRAFT = "draft"
    SEARCHING = "searching"
    ACCEPTED = "accepted"
    PICKED_UP = "picked_up"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class DeliveryClaimModel(Base):
    __tablename__ = "delivery_claims"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    shop_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True
    )
    yandex_claim_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    carrier_class: Mapped[str] = mapped_column(String(16), nullable=False, default=CarrierClass.EXPRESS.value)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default=DeliveryClaimStatus.DRAFT.value, index=True)
    delivery_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    eta_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    offer_payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    yandex_revision: Mapped[str | None] = mapped_column(String(64), nullable=True)
    meta: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    order = relationship("OrderModel", lazy="select")
    shop = relationship("ShopModel", lazy="select")


class MerchantPayoutRequestModel(Base):
    __tablename__ = "merchant_payout_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shop_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount_uzs: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)
    destination: Mapped[str] = mapped_column(String(64), nullable=False, default="bank_card")
    reference: Mapped[str | None] = mapped_column(String(128), nullable=True)
    meta: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
