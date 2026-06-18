"""Marketplace settlement wallets and order payment splits (escrow)."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.base import Base

MONEY_PRECISION = Numeric(12, 2)


class PlatformTransactionStatus(str, enum.Enum):
    HELD_IN_ESCROW = "held_in_escrow"
    RELEASED_TO_MERCHANT = "released_to_merchant"
    REFUNDED = "refunded"


class PlatformProfitSweepStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class MerchantFinanceWalletModel(Base):
    """
    UZS settlement wallet (order payouts). Separate from coin wallet (`merchant_wallets`).
    """

    __tablename__ = "finance_merchant_wallets"

    shop_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("shops.id", ondelete="CASCADE"),
        primary_key=True,
    )
    current_balance: Mapped[Decimal] = mapped_column(
        MONEY_PRECISION, nullable=False, default=Decimal("0.00"), server_default="0"
    )
    frozen_balance: Mapped[Decimal] = mapped_column(
        MONEY_PRECISION, nullable=False, default=Decimal("0.00"), server_default="0"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    shop = relationship("ShopModel", lazy="select")


class PlatformTransactionModel(Base):
    """Atomic split of a paid order across merchant, delivery, and platform."""

    __tablename__ = "platform_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    shop_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("shops.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    total_amount_received: Mapped[Decimal] = mapped_column(MONEY_PRECISION, nullable=False)
    product_subtotal: Mapped[Decimal] = mapped_column(MONEY_PRECISION, nullable=False)
    merchant_share: Mapped[Decimal] = mapped_column(MONEY_PRECISION, nullable=False)
    delivery_share: Mapped[Decimal] = mapped_column(MONEY_PRECISION, nullable=False)
    platform_commission: Mapped[Decimal] = mapped_column(MONEY_PRECISION, nullable=False)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=PlatformTransactionStatus.HELD_IN_ESCROW.value,
        server_default=PlatformTransactionStatus.HELD_IN_ESCROW.value,
        index=True,
    )
    gateway_provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    gateway_reference: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)
    billing_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    order = relationship("OrderModel", lazy="select")
    shop = relationship("ShopModel", lazy="select")


class PlatformProfitSweepModel(Base):
    """Platforma foydasini (released komissiya) shaxsiy kartaga ko'chirish yozuvi.

    Escrow (do'konchilar puli) ga tegmaydi — faqat yetkazilgan buyurtmalar
    komissiyasidan yechib olinadi. Sweep yaratilganda summa 'band' qilinadi,
    fizik o'tkazma admin tomonidan bajarilib, 'completed' deb tasdiqlanadi.
    """

    __tablename__ = "platform_profit_sweeps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    amount_uzs: Mapped[Decimal] = mapped_column(MONEY_PRECISION, nullable=False)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=PlatformProfitSweepStatus.PENDING.value,
        server_default=PlatformProfitSweepStatus.PENDING.value,
        index=True,
    )
    destination: Mapped[str] = mapped_column(String(64), nullable=False, default="personal_card")
    reference: Mapped[str | None] = mapped_column(String(128), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    meta: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
