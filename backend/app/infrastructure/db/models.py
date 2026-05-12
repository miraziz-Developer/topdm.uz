import uuid
from decimal import Decimal

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, BOOLEAN, DECIMAL, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.base import Base


class GlobalShopModel(Base):
    __tablename__ = "global_shops"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    block: Mapped[str] = mapped_column(String(50), nullable=False)
    row: Mapped[str] = mapped_column(String(50), nullable=False)
    shop_metadata: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)


class UnifiedProductModel(Base):
    __tablename__ = "unified_products"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shop_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(DECIMAL(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="UZS")
    embedding: Mapped[list[float]] = mapped_column(Vector(1536), nullable=False)
    ai_generated_tags: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    vision_attributes: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class ProductLeadEventModel(Base):
    __tablename__ = "product_lead_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(64), nullable=False, default="telegram_webapp")
    event_metadata: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)


class IpadromModel(Base):
    __tablename__ = "ipadroms"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(BOOLEAN, nullable=False, default=True)


class CategoryModel(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    name_ru: Mapped[str | None] = mapped_column(String(100), nullable=True)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class ShopModel(Base):
    __tablename__ = "shops"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_phone: Mapped[str] = mapped_column(String(20), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    ipadrom_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("ipadroms.id"), nullable=True)
    floor: Mapped[str | None] = mapped_column(String(50), nullable=True)
    section: Mapped[str | None] = mapped_column(String(100), nullable=True)
    telegram_chat_id: Mapped[int | None] = mapped_column(nullable=True)
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_verified: Mapped[bool] = mapped_column(BOOLEAN, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(BOOLEAN, nullable=False, default=True)
    rating: Mapped[float] = mapped_column(Float, nullable=False, default=0)

    products = relationship("ProductModel", back_populates="shop")


class ProductModel(Base):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shop_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False, index=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    price_negotiable: Mapped[bool] = mapped_column(BOOLEAN, nullable=False, default=False)
    images: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    attributes: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    embedding: Mapped[list[float]] = mapped_column(Vector(1536), nullable=False)
    is_available: Mapped[bool] = mapped_column(BOOLEAN, nullable=False, default=True)
    is_featured: Mapped[bool] = mapped_column(BOOLEAN, nullable=False, default=False)
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    lead_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    visit_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    shop = relationship("ShopModel", back_populates="products")


class LeadModel(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True)
    shop_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False, index=True)
    customer_phone: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    customer_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ref_token: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class TrackingEventModel(Base):
    __tablename__ = "tracking_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    product_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True)
    shop_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=True, index=True)
    ref_token: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    session_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tracking_metadata: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
