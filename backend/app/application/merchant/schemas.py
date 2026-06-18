from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PendingProductItem(BaseModel):
    id: UUID
    shop_id: UUID
    status: str
    moderation_reason: str | None = None
    telegram_file_id: str | None = None
    vision_attributes: dict = Field(default_factory=dict)
    published_product_id: UUID | None = None
    created_at: datetime
    updated_at: datetime | None = None


class PublishPendingProductRequest(BaseModel):
    name: str | None = Field(default=None, max_length=300)
    description: str | None = None
    price_uzs: int | None = Field(default=None, gt=0, lt=100_000_000)
    category_id: UUID | None = None


class RejectPendingProductRequest(BaseModel):
    reason: str = Field(default="Moderatsiya rad etildi.", max_length=500)


class PublishPendingProductResult(BaseModel):
    pending_id: UUID
    product_id: UUID
    product_name: str
    image_url: str | None
    status: str = "published"


class ProductVariantColorInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    sizes: list[str] = Field(default_factory=list)
    image_urls: list[str] = Field(default_factory=list)


class PackCompositionRow(BaseModel):
    size: str = Field(..., min_length=1, max_length=40)
    qty: int = Field(..., ge=1, le=999)


class WholesalePackInput(BaseModel):
    units_per_pack: int = Field(..., ge=2, le=999)
    composition: list[PackCompositionRow] = Field(default_factory=list)


class ProductVariantCatalogInput(BaseModel):
    all_sizes: list[str] = Field(default_factory=list)
    colors: list[ProductVariantColorInput] = Field(default_factory=list)
    sku_stock: dict[str, int] = Field(default_factory=dict)
    fallback_stock: int | None = Field(default=None, ge=0, le=99999)


class MerchantProductCreateFields(BaseModel):
    sale_type: str = Field(default="Chakana", max_length=16)
    pricing_unit: str = Field(default="piece", max_length=16)
    min_order_quantity: int = Field(default=1, ge=1, le=999)
    units_per_pack: int | None = Field(default=None, ge=2, le=999)
    wholesale_pack: WholesalePackInput | None = None


class MerchantProductUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=300)
    description: str | None = Field(default=None, max_length=5000)
    price: int | None = Field(default=None, gt=0, lt=100_000_000)
    stock_count: int | None = Field(default=None, ge=0, le=99999)
    is_available: bool | None = None
    is_featured: bool | None = None
    sale_type: str | None = Field(default=None, max_length=16)
    pricing_unit: str | None = Field(default=None, max_length=16)
    min_order_quantity: int | None = Field(default=None, ge=1, le=999)
    units_per_pack: int | None = Field(default=None, ge=2, le=999)
    wholesale_pack: WholesalePackInput | None = None
    variant_catalog: ProductVariantCatalogInput | None = None


class ChatThreadCreateRequest(BaseModel):
    shop_id: UUID
    customer_key: str = Field(..., min_length=4, max_length=128)
    customer_display_name: str | None = Field(default=None, max_length=120)


class ChatMessageCreateRequest(BaseModel):
    body: str = Field(..., min_length=1, max_length=4000)
    metadata: dict = Field(default_factory=dict)


class ChatMessageItem(BaseModel):
    id: UUID
    thread_id: UUID
    sender_role: str
    body: str
    created_at: datetime
    metadata: dict = Field(default_factory=dict)


class ChatThreadItem(BaseModel):
    id: UUID
    shop_id: UUID
    customer_key: str
    customer_display_name: str | None
    status: str
    created_at: datetime
    updated_at: datetime


class ChatThreadSummary(BaseModel):
    id: UUID
    shop_id: UUID
    customer_key: str
    customer_display_name: str | None
    status: str
    updated_at: datetime
    last_message: str | None = None
    last_sender_role: str | None = None
