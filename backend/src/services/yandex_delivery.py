from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

import httpx
from pydantic import BaseModel, Field

from app.core.config import get_settings


class GeoPoint(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class ShippingEstimate(BaseModel):
    taxi_class: str
    cargo_loaders: int
    cargo_type: str | None
    door_to_door: bool
    estimated_price_uzs: int
    yandex_offer_id: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


@dataclass(slots=True)
class YandexDeliveryGateway:
    timeout_seconds: float = 20.0

    def __post_init__(self) -> None:
        settings = get_settings()
        self._token = settings.yandex_delivery_token
        self._base_url = settings.yandex_delivery_base_url.rstrip("/")
        self._sandbox = settings.is_delivery_sandbox
        self._rub_to_uzs = max(1, int(settings.yandex_delivery_rub_to_uzs))

    async def calculate_shipping_estimate(
        self,
        total_weight_kg: float,
        total_volume_m3: float,
        store_geo: GeoPoint,
        client_geo: GeoPoint,
    ) -> ShippingEstimate:
        taxi_class = "cargo" if total_weight_kg > 10 or total_volume_m3 >= 0.05 else "express"
        cargo_loaders = 1 if taxi_class == "cargo" else 0
        cargo_type = "van" if taxi_class == "cargo" else None

        if not self._token:
            return self._offline_estimate(taxi_class=taxi_class, cargo_loaders=cargo_loaders, cargo_type=cargo_type)

        payload = self._build_check_price_payload(
            taxi_class=taxi_class,
            cargo_loaders=cargo_loaders,
            cargo_type=cargo_type,
            store_geo=store_geo,
            client_geo=client_geo,
        )
        headers = {"Authorization": f"Bearer {self._token}", "Content-Type": "application/json"}

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                resp = await client.post(f"{self._base_url}/b2b/cargo/integration/v2/check-price", json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
        except (httpx.HTTPError, ValueError):
            if self._sandbox:
                return self._offline_estimate(taxi_class=taxi_class, cargo_loaders=cargo_loaders, cargo_type=cargo_type)
            raise

        amount_rub = int(data.get("price", 0) or 0)
        amount_uzs = max(10_000, amount_rub * self._rub_to_uzs)
        return ShippingEstimate(
            taxi_class=taxi_class,
            cargo_loaders=cargo_loaders,
            cargo_type=cargo_type,
            door_to_door=True,
            estimated_price_uzs=amount_uzs,
            yandex_offer_id=str(data.get("offer_id") or ""),
            raw=data if isinstance(data, dict) else {},
        )

    async def create_claim(
        self,
        *,
        request_id: str,
        estimate: ShippingEstimate,
        recipient_phone: str,
        store_geo: GeoPoint,
        client_geo: GeoPoint,
    ) -> str:
        if not self._token or self._sandbox:
            return f"sandbox-{uuid.uuid4()}"

        payload = {
            "route_points": [
                {
                    "id": "pickup",
                    "point": [store_geo.lng, store_geo.lat],
                    "type": "source",
                    "visit_order": 1,
                },
                {
                    "id": "dropoff",
                    "point": [client_geo.lng, client_geo.lat],
                    "type": "destination",
                    "visit_order": 2,
                    "contact": {"phone": recipient_phone},
                },
            ],
            "requirements": {
                "taxi_class": estimate.taxi_class,
                "cargo_loaders": estimate.cargo_loaders,
                "cargo_type": estimate.cargo_type,
                "door_to_door": True,
            },
        }
        headers = {"Authorization": f"Bearer {self._token}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            resp = await client.post(
                f"{self._base_url}/b2b/cargo/integration/v2/claims/create?request_id={request_id}",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
        claim_id = str(data.get("id") or "")
        if not claim_id:
            raise RuntimeError("yandex_claim_create_failed")
        return claim_id

    async def accept_claim(self, claim_id: str) -> dict[str, Any]:
        if not claim_id:
            raise ValueError("claim_id_required")
        if not self._token or self._sandbox:
            return {"id": claim_id, "status": "accepted", "sandbox": True}

        headers = {"Authorization": f"Bearer {self._token}"}
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            resp = await client.post(
                f"{self._base_url}/b2b/cargo/integration/v2/claims/accept?claim_id={claim_id}",
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
        return data if isinstance(data, dict) else {"status": "accepted"}

    @staticmethod
    def _build_check_price_payload(
        *,
        taxi_class: str,
        cargo_loaders: int,
        cargo_type: str | None,
        store_geo: GeoPoint,
        client_geo: GeoPoint,
    ) -> dict[str, Any]:
        return {
            "route_points": [
                {"id": "pickup", "point": [store_geo.lng, store_geo.lat], "type": "source"},
                {"id": "dropoff", "point": [client_geo.lng, client_geo.lat], "type": "destination"},
            ],
            "requirements": {
                "taxi_class": taxi_class,
                "cargo_loaders": cargo_loaders,
                "cargo_type": cargo_type,
                "door_to_door": True,
            },
        }

    def _offline_estimate(self, *, taxi_class: str, cargo_loaders: int, cargo_type: str | None) -> ShippingEstimate:
        base = 22_000 if taxi_class == "express" else 65_000
        return ShippingEstimate(
            taxi_class=taxi_class,
            cargo_loaders=cargo_loaders,
            cargo_type=cargo_type,
            door_to_door=True,
            estimated_price_uzs=base,
            yandex_offer_id=None,
            raw={"mode": "offline_estimate", "sandbox": self._sandbox},
        )
