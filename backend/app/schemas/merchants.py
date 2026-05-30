from __future__ import annotations

from pydantic import BaseModel, Field


class MerchantSpatialSchema(BaseModel):
    """Indoor + WGS84 coordinates for map POI layers."""

    id: str
    name: str
    slug: str
    logo_url: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    floor: int = Field(default=1, ge=1, le=3)
    block_id: str = Field(default="B", max_length=8)
    stall_number: str = Field(default="14", max_length=16)
    status: str = "active"
    rating: float = 0
    review_count: int = 0
    ipadrom: str = "Ippodrom"
    address_label: str = ""
    market_zone: str | None = None
    building: str | None = None
    block_id_letter: str | None = None
    row_label: str | None = None
    floor_level_label: str | None = None
    shop_number: str | None = None
    location_comment: str | None = None
    map_x: float = 0
    map_y: float = 0


class MapStoreFeatureProperties(BaseModel):
    id: str
    name: str
    slug: str
    logo_url: str | None = None
    block_id: str
    stall_number: str
    floor: int
    status: str
    rating: float
    address_label: str


class MapStoreFeatureGeometry(BaseModel):
    type: str = "Point"
    coordinates: list[float]


class MapStoreFeature(BaseModel):
    type: str = "Feature"
    id: str
    geometry: MapStoreFeatureGeometry
    properties: MapStoreFeatureProperties


class MapStoresResponse(BaseModel):
    type: str = "FeatureCollection"
    features: list[MapStoreFeature]
    stores: list[MerchantSpatialSchema]
    cached: bool = False
    market_slug: str = "ippodrom"
