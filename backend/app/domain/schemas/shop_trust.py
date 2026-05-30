"""Store rating / review schemas for CRM and storefront cards."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class StoreRatingMetrics(BaseModel):
    """Aggregated store reputation + operational CRM KPIs (backend-computed)."""

    store_id: UUID
    average_rating: float = Field(..., ge=1.0, le=5.0)
    total_reviews_count: int = Field(..., ge=0)

    order_fulfillment_rate: float = Field(..., ge=0.0, le=100.0)
    product_match_rate: float = Field(..., ge=0.0, le=100.0)
    average_response_time_min: int = Field(..., ge=0)

    updated_at: datetime = Field(default_factory=_utc_now)


class StoreReviewPayload(BaseModel):
    id: UUID
    user_id: UUID | None = None
    store_id: UUID
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = None
    created_at: datetime


class StoreOperationalKpis(BaseModel):
    """Persisted on ``shops.trust_metrics`` (JSONB)."""

    order_fulfillment_rate: float = Field(default=98.0, ge=0.0, le=100.0)
    product_match_rate: float = Field(default=96.0, ge=0.0, le=100.0)
    average_response_time_min: int = Field(default=15, ge=0)
    quality_guarantee: bool = True
    badges: list[str] = Field(default_factory=lambda: ["quality_guarantee", "on_time_delivery"])
    rating_distribution: dict[str, int] = Field(default_factory=dict)

    @field_validator("badges", mode="before")
    @classmethod
    def _coerce_badges(cls, value: Any) -> list[str]:
        if not value:
            return []
        if isinstance(value, list):
            return [str(v) for v in value if v]
        return []

    @classmethod
    def from_json(cls, raw: dict[str, Any] | None) -> StoreOperationalKpis:
        if not raw:
            return cls()
        data = dict(raw)
        if "order_fulfillment_rate" not in data and "on_time_delivery_pct" in data:
            data["order_fulfillment_rate"] = float(data.pop("on_time_delivery_pct"))
        if "average_response_time_min" not in data and "response_time_hours" in data:
            hours = data.pop("response_time_hours")
            if hours is not None:
                data["average_response_time_min"] = max(1, int(float(hours) * 60))
        return cls.model_validate(data)

    def to_json(self) -> dict[str, Any]:
        return self.model_dump(exclude_none=True)


class ShopTrustMetrics(BaseModel):
    """Legacy storefront display shape (derived from ``StoreRatingMetrics``)."""

    on_time_delivery_pct: int = Field(default=0, ge=0, le=100)
    quality_guarantee: bool = False
    response_time_hours: float | None = Field(default=None, ge=0)
    return_rate_pct: float | None = Field(default=None, ge=0, le=100)
    badges: list[str] = Field(default_factory=list)
    rating_distribution: dict[str, int] = Field(default_factory=dict)

    @classmethod
    def from_store_metrics(cls, metrics: StoreRatingMetrics, kpis: StoreOperationalKpis) -> ShopTrustMetrics:
        return cls(
            on_time_delivery_pct=int(round(metrics.order_fulfillment_rate)),
            quality_guarantee=kpis.quality_guarantee,
            response_time_hours=round(metrics.average_response_time_min / 60.0, 1),
            badges=list(kpis.badges),
            rating_distribution=dict(kpis.rating_distribution),
        )

    def to_json(self) -> dict[str, Any]:
        return self.model_dump(exclude_none=True)


class ShopReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    title: str | None = Field(None, max_length=120)
    body: str | None = Field(None, max_length=2000)
    tags: list[str] = Field(default_factory=list)
    order_id: str | None = None
