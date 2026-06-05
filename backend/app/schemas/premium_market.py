from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class PriceBreakdown(BaseModel):
    base_price_cny: float = 0
    cny_to_uzs_rate: float = 0
    base_price_uzs: int = 0
    margin_pct: float = 15
    margin_amount_uzs: int = 0
    weight_kg: float = 0
    cargo_rate_usd_per_kg: float = 0
    usd_to_uzs_rate: int = 0
    cargo_uzs: int = 0
    subtotal_before_round_uzs: int = 0
    round_step_uzs: int = 1000
    total_price_uzs: int = 0


class SkuVariant(BaseModel):
    sku_id: str = ""
    color: str | None = None
    size: str | None = None
    price_cny: float | None = None
    stock: int | None = None
    image_url: str | None = None


class ChinaProductPayload(BaseModel):
    market: Literal["china"] = "china"
    item_id: str
    title: str = ""
    images: list[str] = Field(default_factory=list)
    description: str | None = None
    colors: list[str] = Field(default_factory=list)
    sizes: list[str] = Field(default_factory=list)
    skus: list[SkuVariant] = Field(default_factory=list)
    weight_kg: float = 0.5
    base_price_cny: float = 0
    pricing: PriceBreakdown
    source_url: str | None = None


class LocalShopInfo(BaseModel):
    id: str = ""
    name: str = ""
    slug: str = ""
    location_label: str | None = None
    floor: str | None = None
    stall: str | None = None


class LocalProductPayload(BaseModel):
    market: Literal["local"] = "local"
    item_id: str
    name: str = ""
    images: list[str] = Field(default_factory=list)
    description: str | None = None
    stock_count: int = 0
    is_available: bool = True
    colors: list[str] = Field(default_factory=list)
    sizes: list[str] = Field(default_factory=list)
    size_matrix: dict[str, list[str]] = Field(default_factory=dict)
    shop: LocalShopInfo = Field(default_factory=LocalShopInfo)
    product_price_uzs: int = 0
    courier_fee_uzs: int = 0
    courier_eta_label: str = "Bugun, 2–4 soat ichida"
    pricing: PriceBreakdown


class MarketChinaResponse(BaseModel):
    item: ChinaProductPayload


class MarketLocalResponse(BaseModel):
    item: LocalProductPayload


class ChinaCatalogItem(BaseModel):
    item_id: str
    title: str = ""
    image_url: str = ""
    total_price_uzs: int = 0
    base_price_cny: float = 0
    source_url: str | None = None


class MarketChinaCatalogResponse(BaseModel):
    items: list[ChinaCatalogItem] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class MarketChinaImportResponse(BaseModel):
    item: ChinaCatalogItem


class AutoSearchItem(BaseModel):
    item_id: str
    title: str = ""
    image_url: str = ""
    price_cny: float = 0
    total_price_uzs: int = 0
    source_url: str | None = None


class MarketAutoSearchResponse(BaseModel):
    query: str = ""
    translated_query: str = ""
    page: int = 1
    items: list[AutoSearchItem] = Field(default_factory=list)
