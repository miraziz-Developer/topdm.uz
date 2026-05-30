from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class OrderClaimStatus(str, enum.Enum):
    pending = "Pending"
    accepted = "Accepted"
    courier_assigned = "Courier_Assigned"
    delivered = "Delivered"


class ChannelSource(str, enum.Enum):
    web = "web"
    merchant_app = "merchant_app"
    telegram_webapp = "telegram_webapp"


class MerchantProfile(Base):
    __tablename__ = "bazaar_merchant_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shop_name: Mapped[str] = mapped_column(String(180), nullable=False)
    phone: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    bazaar_name: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    sector: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    block: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    rasta_number: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    latitude: Mapped[Decimal] = mapped_column(Numeric(10, 7), nullable=False)
    longitude: Mapped[Decimal] = mapped_column(Numeric(10, 7), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    claims: Mapped[list[OrderClaim]] = relationship(back_populates="merchant", cascade="all, delete-orphan")


class OrderClaim(Base):
    __tablename__ = "bazaar_order_claims"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    merchant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bazaar_merchant_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    yandex_claim_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    status: Mapped[OrderClaimStatus] = mapped_column(
        Enum(OrderClaimStatus, name="bazaar_order_claim_status"),
        default=OrderClaimStatus.pending,
        nullable=False,
        index=True,
    )
    delivery_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"), nullable=False)
    taxi_class: Mapped[str] = mapped_column(String(24), default="express", nullable=False)
    source_channel: Mapped[ChannelSource] = mapped_column(
        Enum(ChannelSource, name="bazaar_channel_source"),
        default=ChannelSource.web,
        nullable=False,
    )
    payload_json: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    merchant: Mapped[MerchantProfile] = relationship(back_populates="claims")
