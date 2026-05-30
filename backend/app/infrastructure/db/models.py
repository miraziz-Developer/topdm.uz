import uuid
from datetime import date, datetime
from decimal import Decimal

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, BOOLEAN, BigInteger, DECIMAL, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
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


class AppUserModel(Base):
    """Platform user (consumer or merchant owner)."""

    __tablename__ = "app_users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True, index=True)
    telegram_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ShopModel(Base):
    __tablename__ = "shops"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_phone: Mapped[str] = mapped_column(String(20), nullable=False, unique=True, index=True)
    owner_email: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True, index=True)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    ipadrom_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("ipadroms.id"), nullable=True)
    floor: Mapped[str | None] = mapped_column(String(50), nullable=True)
    section: Mapped[str | None] = mapped_column(String(100), nullable=True)
    telegram_chat_id: Mapped[int | None] = mapped_column(nullable=True)
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_verified: Mapped[bool] = mapped_column(BOOLEAN, nullable=False, default=False)
    is_featured: Mapped[bool] = mapped_column(BOOLEAN, nullable=False, default=False)
    featured_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(BOOLEAN, nullable=False, default=True)
    rating: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    review_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    trust_metrics: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    indoor_stall_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("indoor_stalls.id"), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    market_zone: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    block_sector: Mapped[str | None] = mapped_column(String(120), nullable=True)
    stall_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    storefront_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    registration_source: Mapped[str] = mapped_column(String(32), nullable=False, default="admin", server_default="admin")
    indoor_pin_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    indoor_pin_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    coins_balance: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    products = relationship("ProductModel", back_populates="shop")
    ipadrom = relationship("IpadromModel", lazy="joined", foreign_keys=[ipadrom_id])


class ProductModel(Base):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shop_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False, index=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    sale_type: Mapped[str] = mapped_column(String(16), nullable=False, default="Chakana", index=True)
    min_order_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    price_negotiable: Mapped[bool] = mapped_column(BOOLEAN, nullable=False, default=False)
    images: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    attributes: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    embedding: Mapped[list[float]] = mapped_column(Vector(1536), nullable=False)
    visual_embedding: Mapped[list[float] | None] = mapped_column(Vector(768), nullable=True)
    stock_count: Mapped[int] = mapped_column(Integer, nullable=False, default=5, server_default="5")
    is_available: Mapped[bool] = mapped_column(BOOLEAN, nullable=False, default=True)
    is_featured: Mapped[bool] = mapped_column(BOOLEAN, nullable=False, default=False)
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    lead_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    visit_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    weight_kg: Mapped[Decimal | None] = mapped_column(DECIMAL(8, 3), nullable=True)
    length_cm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    width_cm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height_cm: Mapped[int | None] = mapped_column(Integer, nullable=True)

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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class OrderModel(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_phone: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True)
    shop_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False, index=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    total_price: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    fulfillment_type: Mapped[str] = mapped_column(String(20), nullable=False, default="delivery", server_default="delivery")
    pickup_date: Mapped[date | None] = mapped_column(Date(), nullable=True)
    pickup_time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    customer_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    ref_token: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    delivery_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivery_city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    delivery_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    delivery_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    carrier_class: Mapped[str | None] = mapped_column(String(16), nullable=True)
    delivery_cost_uzs: Mapped[int | None] = mapped_column(Integer, nullable=True)
    delivery_eta_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    product = relationship("ProductModel")
    shop = relationship("ShopModel")


class IndoorFloorPlanModel(Base):
    __tablename__ = "indoor_floor_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    market_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ipadroms.id"), nullable=False, index=True)
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    view_box: Mapped[str] = mapped_column(String(64), nullable=False, default="0 0 420 260")
    geojson: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    navigation_graph: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    svg_overlay_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(BOOLEAN, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class IndoorStallModel(Base):
    __tablename__ = "indoor_stalls"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    floor_plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("indoor_floor_plans.id"), nullable=False, index=True)
    stall_code: Mapped[str] = mapped_column(String(32), nullable=False)
    block_code: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="vacant")
    local_x: Mapped[float] = mapped_column(Float, nullable=False)
    local_y: Mapped[float] = mapped_column(Float, nullable=False)
    width: Mapped[float] = mapped_column(Float, nullable=False, default=28)
    height: Mapped[float] = mapped_column(Float, nullable=False, default=24)
    graph_node_id: Mapped[str] = mapped_column(String(64), nullable=False)
    shop_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=True, index=True)
    geometry: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class MerchantCredentialModel(Base):
    __tablename__ = "merchant_credentials"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shop_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    login_code: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    shop = relationship("ShopModel", lazy="joined")


class MerchantPendingProductModel(Base):
    __tablename__ = "merchant_pending_products"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shop_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    telegram_user_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    telegram_chat_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    telegram_file_id: Mapped[str | None] = mapped_column(String(256), nullable=True)
    vision_attributes: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)
    moderation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ChatThreadModel(Base):
    __tablename__ = "chat_threads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shop_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_key: Mapped[str] = mapped_column(String(128), nullable=False)
    customer_display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    messages = relationship("ChatMessageModel", back_populates="thread", order_by="ChatMessageModel.created_at")


class ChatMessageModel(Base):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_threads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_role: Mapped[str] = mapped_column(String(20), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    message_metadata: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    thread = relationship("ChatThreadModel", back_populates="messages")


class RouteStatModel(Base):
    __tablename__ = "route_stats"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    market_slug: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    start_node_id: Mapped[str] = mapped_column(String(64), nullable=False)
    goal_node_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    node_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="api")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)


class MerchantAlertLogModel(Base):
    __tablename__ = "merchant_alert_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shop_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    alert_type: Mapped[str] = mapped_column(String(64), nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
