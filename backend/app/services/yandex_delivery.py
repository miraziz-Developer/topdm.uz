"""
Yandex Delivery B2B gateway for Bozorliii.uz bazaar logistics.

Flow: check-price → claims/create → claims/info → claims/accept
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from enum import Enum
from typing import Any

import httpx
from loguru import logger
from pydantic import BaseModel, Field

from app.core.config import Settings, get_settings

DEFAULT_BASE_URL = "https://b2b.taxi.yandex.net"
BAZAAR_MARKET_LABEL = "Ippodrom"

CARGO_WEIGHT_THRESHOLD_KG = 10.0
CARGO_VOLUME_THRESHOLD_M3 = 0.05


class YandexDeliveryAPIError(Exception):
    """Yandex HTTP or payload contract violation."""

    def __init__(self, message: str, *, status_code: int | None = None, payload: Any = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload


class CarrierClass(str, Enum):
    EXPRESS = "express"
    CARGO = "cargo"


class MerchantBazaarData(BaseModel):
    """Merchant stall inside Ippodrom bazaar."""

    sector: str = ""
    block: str = ""
    rasta: str = ""
    phone: str = ""
    coordinates: tuple[float, float]  # (lng, lat)
    name: str = ""
    city: str = "Toshkent"

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> MerchantBazaarData:
        coords = data.get("coordinates") or data.get("geo") or [0.0, 0.0]
        if isinstance(coords, dict):
            lng = float(coords.get("lng") or coords.get("longitude") or 0)
            lat = float(coords.get("lat") or coords.get("latitude") or 0)
            coords = [lng, lat]
        return cls(
            sector=str(data.get("sector") or data.get("market_zone") or ""),
            block=str(data.get("block") or data.get("block_sector") or ""),
            rasta=str(data.get("rasta") or data.get("stall") or data.get("stall_number") or ""),
            phone=str(data.get("phone") or data.get("owner_phone") or ""),
            coordinates=(float(coords[0]), float(coords[1])),
            name=str(data.get("name") or data.get("shop_name") or "Do'kon"),
            city=str(data.get("city") or "Toshkent"),
        )


class CustomerDeliveryData(BaseModel):
    phone: str
    address: str
    coordinates: tuple[float, float]  # (lng, lat)
    name: str = "Mijoz"
    city: str = "Toshkent"

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> CustomerDeliveryData:
        coords = data.get("coordinates") or data.get("geo") or [0.0, 0.0]
        if isinstance(coords, dict):
            lng = float(coords.get("lng") or coords.get("longitude") or 0)
            lat = float(coords.get("lat") or coords.get("latitude") or 0)
            coords = [lng, lat]
        return cls(
            phone=str(data.get("phone") or data.get("customer_phone") or ""),
            address=str(data.get("address") or data.get("delivery_address") or ""),
            coordinates=(float(coords[0]), float(coords[1])),
            name=str(data.get("name") or data.get("contact_name") or "Mijoz"),
            city=str(data.get("city") or data.get("delivery_city") or "Toshkent"),
        )


class CartItemMetrics(BaseModel):
    title: str = "Mahsulot"
    quantity: int = Field(default=1, ge=1, le=99)
    weight_kg: float = Field(default=0.5, gt=0)
    length_m: float = Field(default=0.3, gt=0)
    width_m: float = Field(default=0.3, gt=0)
    height_m: float = Field(default=0.1, gt=0)
    cost_value_uzs: int = Field(default=0, ge=0)


class CartMetrics(BaseModel):
    items: list[CartItemMetrics]
    is_heavy: bool = False

    @property
    def total_weight_kg(self) -> float:
        return sum(i.weight_kg * i.quantity for i in self.items)


def build_bazaar_source_comment(merchant_data: dict[str, Any] | MerchantBazaarData) -> str:
    """Bozorliii bazaar driver routing string."""
    if isinstance(merchant_data, MerchantBazaarData):
        m = merchant_data
    else:
        m = MerchantBazaarData.from_dict(merchant_data)
    return (
        f"Bozor: {BAZAAR_MARKET_LABEL}, Sektor: {m.sector or '—'}, "
        f"Blok: {m.block or '—'}, Rasta: {m.rasta or '—'}. "
        f"Tel: {m.phone or '—'}"
    )


def resolve_carrier_class(*, total_weight_kg: float, total_volume_m3: float) -> str:
    if total_weight_kg > CARGO_WEIGHT_THRESHOLD_KG or total_volume_m3 >= CARGO_VOLUME_THRESHOLD_M3:
        return CarrierClass.CARGO.value
    return CarrierClass.EXPRESS.value


def build_routing_requirements(*, total_weight_kg: float, total_volume_m3: float) -> dict[str, Any]:
    """
    Smart dimensional splitter → Yandex requirements block.
    Always intended for door-to-door delivery inside bazaar perimeter.
    """
    carrier = resolve_carrier_class(total_weight_kg=total_weight_kg, total_volume_m3=total_volume_m3)
    if carrier == CarrierClass.CARGO.value:
        return {
            "taxi_class": "cargo",
            "cargo_type": "van",
            "cargo_loaders": 1,
        }
    return {"taxi_class": "express"}


def _normalize_phone_e164(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    if digits.startswith("998"):
        return f"+{digits}"
    if len(digits) == 9:
        return f"+998{digits}"
    return phone if phone.startswith("+") else f"+{digits}"


def _coords_pair(coords: list[float] | tuple[float, float]) -> tuple[float, float]:
    if len(coords) != 2:
        raise YandexDeliveryAPIError("coordinates_must_be_lng_lat_pair")
    lng, lat = float(coords[0]), float(coords[1])
    if not (-180 <= lng <= 180 and -90 <= lat <= 90):
        raise YandexDeliveryAPIError("coordinates_out_of_bounds")
    return lng, lat


def _parse_decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value)).quantize(Decimal("0.0001"))
    except (InvalidOperation, TypeError) as exc:
        raise YandexDeliveryAPIError("invalid_price_format") from exc


def _safe_json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except Exception:
        return {"text": response.text[:500]}


@dataclass(frozen=True, slots=True)
class AcceptResult:
    claim_id: str
    status: str
    raw: dict[str, Any]


class YandexDeliveryGateway:
    """
    Production async gateway for Yandex Delivery B2B API.

    Environment:
      - YANDEX_DELIVERY_TOKEN → Authorization: Bearer <token>
      - YANDEX_DELIVERY_BASE_URL (default https://b2b.taxi.yandex.net)
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._base = (self._settings.yandex_delivery_base_url or DEFAULT_BASE_URL).rstrip("/")
        self._token = (self._settings.yandex_delivery_token or "").strip()
        self._rub_to_uzs = int(self._settings.yandex_delivery_rub_to_uzs or 150)
        self._timeout = float(self._settings.external_api_timeout_seconds)

    @property
    def is_configured(self) -> bool:
        return bool(self._token)

    def _headers(self) -> dict[str, str]:
        if not self._token:
            raise YandexDeliveryAPIError("yandex_delivery_token_missing")
        return {
            "Authorization": f"Bearer {self._token}",
            "Accept-Language": "ru",
            "Content-Type": "application/json",
        }

    def _rub_to_uzs_int(self, rub: Decimal) -> int:
        return int((rub * Decimal(self._rub_to_uzs)).quantize(Decimal("1")))

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json_body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        url = f"{self._base}{path}"
        log = logger.bind(yandex_path=path, yandex_method=method)
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.request(
                    method,
                    url,
                    headers=self._headers(),
                    params=params,
                    json=json_body,
                )
        except httpx.TimeoutException as exc:
            log.warning("yandex_delivery_timeout")
            raise YandexDeliveryAPIError("yandex_delivery_timeout") from exc
        except httpx.HTTPError as exc:
            log.warning("yandex_delivery_http_error", error=str(exc))
            raise YandexDeliveryAPIError("yandex_delivery_http_error") from exc

        if response.status_code >= 400:
            log.warning(
                "yandex_delivery_api_error",
                status_code=response.status_code,
                body=response.text[:800],
            )
            raise YandexDeliveryAPIError(
                f"yandex_http_{response.status_code}",
                status_code=response.status_code,
                payload=_safe_json(response),
            )

        data = response.json()
        if not isinstance(data, dict):
            raise YandexDeliveryAPIError("yandex_invalid_json_object", payload=data)
        return data

    async def calculate_shipping_estimate(
        self,
        total_weight_kg: float,
        total_volume_m3: float,
        store_geo: list[float],
        client_geo: list[float],
        *,
        merchant_data: dict[str, Any] | None = None,
        customer_data: dict[str, Any] | None = None,
        cart_items: list[CartItemMetrics] | None = None,
    ) -> dict[str, Any]:
        """
        POST /b2b/cargo/integration/v2/check-price

        Applies dimensional routing (cargo vs express) and forces door-to-door.
        """
        store_lng, store_lat = _coords_pair(store_geo)
        client_lng, client_lat = _coords_pair(client_geo)

        carrier_class = resolve_carrier_class(
            total_weight_kg=float(total_weight_kg),
            total_volume_m3=float(total_volume_m3),
        )
        requirements = build_routing_requirements(
            total_weight_kg=float(total_weight_kg),
            total_volume_m3=float(total_volume_m3),
        )

        if cart_items:
            items_payload = [
                {
                    "quantity": item.quantity,
                    "weight": item.weight_kg,
                    "size": {
                        "length": item.length_m,
                        "width": item.width_m,
                        "height": item.height_m,
                    },
                    "pickup_point": 1,
                    "dropoff_point": 2,
                    "cost_value": str(item.cost_value_uzs),
                    "cost_currency": "UZS",
                }
                for item in cart_items
            ]
        else:
            per_item_weight = max(0.1, float(total_weight_kg))
            items_payload = [
                {
                    "quantity": 1,
                    "weight": per_item_weight,
                    "size": {"length": 0.3, "width": 0.3, "height": 0.1},
                    "pickup_point": 1,
                    "dropoff_point": 2,
                    "cost_value": "0",
                    "cost_currency": "UZS",
                }
            ]

        store_comment = (
            build_bazaar_source_comment(merchant_data)
            if merchant_data
            else f"Bozor: {BAZAAR_MARKET_LABEL}"
        )
        client_address = (
            str(customer_data.get("address", "Mijoz manzili"))
            if customer_data
            else "Mijoz manzili"
        )

        body: dict[str, Any] = {
            "items": items_payload,
            "route_points": [
                {
                    "id": 1,
                    "coordinates": [store_lng, store_lat],
                    "fullname": store_comment,
                },
                {
                    "id": 2,
                    "coordinates": [client_lng, client_lat],
                    "fullname": client_address,
                },
            ],
            "requirements": requirements,
            "skip_door_to_door": False,
        }

        log = logger.bind(
            event="calculate_shipping_estimate",
            carrier_class=carrier_class,
            weight_kg=total_weight_kg,
            volume_m3=total_volume_m3,
        )

        if not self.is_configured:
            offline = self._offline_estimate(total_weight_kg, total_volume_m3, carrier_class)
            log.info("yandex_offline_estimate", **offline)
            return offline

        data = await self._request("POST", "/b2b/cargo/integration/v2/check-price", json_body=body)

        price_raw = data.get("price")
        if price_raw is None:
            price_raw = data.get("total_price") or "0"
        price_rub = _parse_decimal(price_raw)
        eta_raw = data.get("eta")
        eta_minutes = int(eta_raw) if isinstance(eta_raw, (int, float)) and eta_raw < 500 else 35
        if isinstance(eta_raw, (int, float)) and eta_raw > 120:
            eta_minutes = max(15, int(eta_raw) // 60)

        result = {
            "carrier_class": carrier_class,
            "taxi_class": requirements.get("taxi_class"),
            "delivery_cost_rub": str(price_rub),
            "delivery_cost_uzs": self._rub_to_uzs_int(price_rub),
            "distance_meters": data.get("distance_meters"),
            "eta_minutes": eta_minutes,
            "door_to_door": True,
            "requirements": requirements,
            "raw": data,
        }
        log.info("yandex_check_price_ok", delivery_cost_uzs=result["delivery_cost_uzs"])
        return result

    async def create_delivery_claim(
        self,
        order_id: str,
        merchant_data: dict[str, Any],
        customer_data: dict[str, Any],
        *,
        cart_metrics: CartMetrics | None = None,
        request_id: str | None = None,
        offer_payload: str | None = None,
    ) -> dict[str, Any]:
        """
        POST /claims/create then POST /claims/info for definitive pricing.

        merchant_data keys: sector, block, rasta, phone, coordinates, name, city
        customer_data keys: phone, address, coordinates, name, city
        """
        merchant = MerchantBazaarData.from_dict(merchant_data)
        customer = CustomerDeliveryData.from_dict(customer_data)
        source_comment = build_bazaar_source_comment(merchant)

        if cart_metrics is None:
            cart_metrics = CartMetrics(
                items=[CartItemMetrics(title="Buyurtma", quantity=1, weight_kg=0.5)],
                is_heavy=resolve_carrier_class(total_weight_kg=0.5, total_volume_m3=0.0) == "cargo",
            )

        total_weight = float(cart_metrics.total_weight_kg)
        total_volume = sum(
            (i.length_m * i.width_m * i.height_m * i.quantity) for i in cart_metrics.items
        )
        requirements = build_routing_requirements(
            total_weight_kg=total_weight,
            total_volume_m3=total_volume,
        )

        store_lng, store_lat = merchant.coordinates
        client_lng, client_lat = customer.coordinates

        items = [
            {
                "title": item.title[:120],
                "quantity": item.quantity,
                "weight": item.weight_kg,
                "size": {
                    "length": item.length_m,
                    "width": item.width_m,
                    "height": item.height_m,
                },
                "cost_value": str(item.cost_value_uzs),
                "cost_currency": "UZS",
                "pickup_point": 1,
                "droppof_point": 2,
                "extra_id": f"{order_id}-{idx}",
            }
            for idx, item in enumerate(cart_metrics.items, start=1)
        ]

        create_body: dict[str, Any] = {
            "items": items,
            "route_points": [
                {
                    "point_id": 1,
                    "visit_order": 1,
                    "type": "source",
                    "contact": {
                        "name": merchant.name[:80],
                        "phone": _normalize_phone_e164(merchant.phone),
                    },
                    "address": {
                        "fullname": source_comment,
                        "shortname": source_comment[:128],
                        "coordinates": [store_lng, store_lat],
                        "country": "Uzbekistan",
                        "city": merchant.city,
                        "comment": source_comment,
                    },
                    "skip_confirmation": True,
                },
                {
                    "point_id": 2,
                    "visit_order": 2,
                    "type": "destination",
                    "contact": {
                        "name": customer.name[:80],
                        "phone": _normalize_phone_e164(customer.phone),
                    },
                    "address": {
                        "fullname": customer.address,
                        "shortname": customer.address[:128],
                        "coordinates": [client_lng, client_lat],
                        "country": "Uzbekistan",
                        "city": customer.city,
                        "comment": customer.address,
                    },
                    "skip_confirmation": False,
                },
            ],
            "client_requirements": requirements,
            "skip_door_to_door": False,
            "optional_return": False,
            "comment": source_comment,
            "referral_source": "bozorliii_uz",
            "shipping_document": str(order_id),
        }
        if offer_payload:
            create_body["offer_payload"] = offer_payload

        req_id = request_id or str(uuid.uuid4())
        log = logger.bind(event="create_delivery_claim", order_id=order_id, request_id=req_id)

        created = await self._request(
            "POST",
            "/b2b/cargo/integration/v2/claims/create",
            params={"request_id": req_id},
            json_body=create_body,
        )
        claim_id = str(created.get("id") or created.get("claim_id") or "")
        if not claim_id:
            raise YandexDeliveryAPIError("claim_id_missing_in_create_response", payload=created)

        info = await self.get_claim_info(claim_id)
        status = str(info.get("status") or created.get("status") or "new")
        price_rub, currency = self._extract_price_from_claim(info, fallback_create=created)
        revision = str(info.get("revision") or created.get("revision") or "") or None

        result = {
            "claim_id": claim_id,
            "order_id": str(order_id),
            "status": status,
            "revision": revision,
            "source_comment": source_comment,
            "carrier_class": requirements.get("taxi_class"),
            "delivery_cost_rub": str(price_rub),
            "delivery_cost_uzs": self._rub_to_uzs_int(price_rub),
            "currency": currency,
            "ready_for_approval": status in {"ready_for_approval", "accepted", "performer_lookup"},
            "mapped_status": self.map_yandex_status(status),
            "raw_create": created,
            "raw_info": info,
        }
        log.info(
            "yandex_claim_created",
            claim_id=claim_id,
            delivery_cost_uzs=result["delivery_cost_uzs"],
            status=status,
        )
        return result

    async def accept_and_lock_claim(self, claim_id: str, *, version: int | None = None) -> bool:
        """
        POST /b2b/cargo/integration/v1/claims/accept

        Seal tariff and start active driver matching — call after payment webhook.
        """
        params: dict[str, Any] = {"claim_id": claim_id}
        if version is not None:
            params["version"] = version

        log = logger.bind(event="accept_and_lock_claim", claim_id=claim_id)
        data = await self._request("POST", "/b2b/cargo/integration/v1/claims/accept", params=params)
        status = str(data.get("status") or "accepted")
        locked = status in {"accepted", "performer_lookup", "performer_found", "pickup_arrived", "pickuped"}
        log.info("yandex_claim_accepted", claim_id=claim_id, status=status, locked=locked)
        return locked

    async def get_claim_info(self, claim_id: str) -> dict[str, Any]:
        return await self._request(
            "POST",
            "/b2b/cargo/integration/v2/claims/info",
            params={"claim_id": claim_id},
        )

    async def inspect_cancel_penalty(self, claim_id: str) -> dict[str, Any]:
        return await self._request(
            "POST",
            "/b2b/cargo/integration/v1/claims/cancel-info",
            params={"claim_id": claim_id},
        )

    async def terminate_active_claim(self, claim_id: str) -> dict[str, Any]:
        inspection = await self.inspect_cancel_penalty(claim_id)
        cancel_state = str(inspection.get("cancel_state") or "")
        if cancel_state in {"paid_cancel_forbidden", "free_cancel_forbidden"}:
            raise YandexDeliveryAPIError("cancel_not_allowed", payload=inspection)
        cancelled = await self._request(
            "POST",
            "/b2b/cargo/integration/v1/claims/cancel",
            params={"claim_id": claim_id},
            json_body={"cancel_state": "free"},
        )
        return {"claim_id": claim_id, "inspection": inspection, "cancel": cancelled}

    def _offline_estimate(
        self,
        total_weight_kg: float,
        total_volume_m3: float,
        carrier_class: str,
    ) -> dict[str, Any]:
        base = int(self._settings.finance_delivery_base_uzs)
        surcharge = int(total_weight_kg * 2500)
        mult = 1.45 if carrier_class == "cargo" else 1.0
        cost_uzs = int((base + surcharge) * mult)
        return {
            "carrier_class": carrier_class,
            "taxi_class": carrier_class,
            "delivery_cost_rub": "0",
            "delivery_cost_uzs": cost_uzs,
            "distance_meters": None,
            "eta_minutes": 35 + (15 if carrier_class == "cargo" else 0),
            "door_to_door": True,
            "requirements": build_routing_requirements(
                total_weight_kg=total_weight_kg,
                total_volume_m3=total_volume_m3,
            ),
            "offline": True,
            "raw": {},
        }

    @staticmethod
    def _extract_price_from_claim(info: dict[str, Any], *, fallback_create: dict[str, Any]) -> tuple[Decimal, str]:
        price_block = info.get("price") or fallback_create.get("price") or {}
        if isinstance(price_block, dict):
            raw = price_block.get("total") or price_block.get("final_price") or price_block.get("price")
            currency = str(price_block.get("currency") or "RUB")
            if raw is not None:
                return _parse_decimal(raw), currency
        if isinstance(price_block, (str, int, float, Decimal)):
            return _parse_decimal(price_block), "RUB"
        return Decimal("0"), "RUB"

    @staticmethod
    def map_yandex_status(status: str) -> str:
        normalized = (status or "").lower()
        mapping = {
            "new": "draft",
            "estimating": "draft",
            "ready_for_approval": "draft",
            "accepted": "accepted",
            "performer_lookup": "searching",
            "performer_draft": "searching",
            "performer_found": "searching",
            "pickup_arrived": "picked_up",
            "pickuped": "picked_up",
            "delivery_arrived": "picked_up",
            "delivered": "delivered",
            "delivered_finish": "delivered",
            "cancelled": "cancelled",
            "cancelled_with_payment": "cancelled",
            "failed": "cancelled",
        }
        return mapping.get(normalized, "searching")


# Backward-compatible aliases for existing application layers
YandexDeliveryEngine = YandexDeliveryGateway

StoreLocationData = MerchantBazaarData


def store_source_comment(merchant_data: dict[str, Any] | MerchantBazaarData) -> str:
    return build_bazaar_source_comment(merchant_data)
