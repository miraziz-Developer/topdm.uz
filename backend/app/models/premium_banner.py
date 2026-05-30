from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.base import Base

BannerStatus = Literal["pending_payment", "active", "expired", "cancelled", "rejected"]
PaymentMethod = Literal["coin", "click", "payme"]


class PremiumTariffModel(Base):
    __tablename__ = "premium_tariffs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, index=True)
    name_uz: Mapped[str] = mapped_column(String(120), nullable=False)
    name_ru: Mapped[str | None] = mapped_column(String(120), nullable=True)
    priority_weight: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    dwell_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=4500)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    badge_label: Mapped[str | None] = mapped_column(String(40), nullable=True)
    frame_style: Mapped[str] = mapped_column(String(32), nullable=False, default="standard")
    price_uzs_monthly: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    coin_cost: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    banners = relationship("SponsoredBannerModel", back_populates="tariff")


class SponsoredBannerModel(Base):
    __tablename__ = "sponsored_banners"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shop_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    tariff_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("premium_tariffs.id"), nullable=False)
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    product_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    cta_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending_payment", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    package_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    queue_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    amount_uzs: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(32), nullable=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    impression_count: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    click_count: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    ctr_percent: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False, default=0)
    coins_spent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    expired_notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    shop = relationship("ShopModel", lazy="joined")
    tariff = relationship("PremiumTariffModel", back_populates="banners", lazy="joined")
    product = relationship("ProductModel", lazy="joined")
    transactions = relationship("BannerPaymentTransactionModel", back_populates="banner", lazy="selectin")

    @property
    def impressions_count(self) -> int:
        return int(self.impression_count or 0)

    @property
    def clicks_count(self) -> int:
        return int(self.click_count or 0)


class MerchantWalletModel(Base):
    __tablename__ = "merchant_wallets"

    shop_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shops.id", ondelete="CASCADE"), primary_key=True)
    coin_balance: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class BannerPaymentTransactionModel(Base):
    __tablename__ = "banner_payment_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    banner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sponsored_banners.id", ondelete="CASCADE"), nullable=False, index=True)
    shop_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    tariff_code: Mapped[str] = mapped_column(String(32), nullable=False)
    amount_uzs: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    coin_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payment_method: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="completed")
    external_reference: Mapped[str | None] = mapped_column(String(128), nullable=True)
    transaction_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    banner = relationship("SponsoredBannerModel", back_populates="transactions")
