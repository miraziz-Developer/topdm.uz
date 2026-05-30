from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.base import Base


class CoinPackageModel(Base):
    __tablename__ = "coin_packages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, index=True)
    name_uz: Mapped[str] = mapped_column(String(120), nullable=False)
    coins: Mapped[int] = mapped_column(Integer, nullable=False)
    amount_uzs: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PaymentTransactionModel(Base):
    """Gateway top-up ledger (Click / Payme / manual)."""

    __tablename__ = "payment_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shop_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    coin_package_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("coin_packages.id"), nullable=True)
    amount_uzs: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    coins_added: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)
    provider_trans_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)
    checkout_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    coin_package = relationship("CoinPackageModel", lazy="joined")
