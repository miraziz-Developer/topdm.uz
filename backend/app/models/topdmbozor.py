"""topdmbozor.uz — P2P Click + SMS webhook + BTS marketplace (alohida jadvallar)."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.base import Base


class TdbOrderStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    completed = "completed"
    canceled = "canceled"


class TdbDeliveryStatus(str, enum.Enum):
    pending = "pending"
    shipped = "shipped"
    delivered = "delivered"


class TdbUser(Base):
    __tablename__ = "tdb_users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    orders: Mapped[list["TdbOrder"]] = relationship(back_populates="user")


class TdbMerchant(Base):
    __tablename__ = "tdb_merchants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tdb_users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    shop_name: Mapped[str] = mapped_column(String(255), nullable=False)
    card_number: Mapped[str] = mapped_column(String(32), nullable=False)
    balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    frozen_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0"))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    orders: Mapped[list["TdbOrder"]] = relationship(back_populates="merchant")


class TdbOrder(Base):
    __tablename__ = "tdb_orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tdb_users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    merchant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tdb_merchants.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[TdbOrderStatus] = mapped_column(
        Enum(TdbOrderStatus, name="tdb_order_status", native_enum=False),
        nullable=False,
        default=TdbOrderStatus.pending,
        index=True,
    )
    delivery_status: Mapped[TdbDeliveryStatus] = mapped_column(
        Enum(TdbDeliveryStatus, name="tdb_delivery_status", native_enum=False),
        nullable=False,
        default=TdbDeliveryStatus.pending,
        index=True,
    )
    tracking_number: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    click_p2p_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user: Mapped[TdbUser] = relationship(back_populates="orders")
    merchant: Mapped[TdbMerchant] = relationship(back_populates="orders")
