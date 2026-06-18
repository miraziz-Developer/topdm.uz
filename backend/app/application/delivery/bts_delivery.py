"""BTS Express yetkazish — quote, buyurtma yaratish, tracking."""
from __future__ import annotations

import math
import re
from decimal import Decimal
from typing import Any
from uuid import UUID

from app.application.delivery.tariff_splitter import (
    TariffDecision,
    compute_tariff_from_lines,
    product_physics,
)
from app.application.map.store_locations import resolve_map_coordinates, resolve_wgs84_coordinates
from app.core.config import Settings, get_settings
from app.infrastructure.db.models import OrderModel, ProductModel, ShopModel
from app.infrastructure.delivery.bts_client import BtsDeliveryAPIError, BtsDeliveryClient

DEFAULT_MARKET_NAME = "Ippodrom"


class BtsDeliveryError(ValueError):
    pass


class DeliveryQuoteOption:
    __slots__ = ("carrier_class", "label_uz", "delivery_cost_uzs", "eta_minutes", "offer_payload", "tariff")

    def __init__(
        self,
        *,
        carrier_class: str,
        label_uz: str,
        delivery_cost_uzs: int,
        eta_minutes: int | None,
        offer_payload: str | None,
        tariff: TariffDecision,
    ) -> None:
        self.carrier_class = carrier_class
        self.label_uz = label_uz
        self.delivery_cost_uzs = delivery_cost_uzs
        self.eta_minutes = eta_minutes
        self.offer_payload = offer_payload
        self.tariff = tariff

    def to_dict(self) -> dict[str, Any]:
        return {
            "carrier_class": self.carrier_class,
            "label": self.label_uz,
            "delivery_cost_uzs": self.delivery_cost_uzs,
            "eta_minutes": self.eta_minutes,
            "offer_payload": self.offer_payload,
            "provider": "bts",
            "billable_weight_kg": float(self.tariff.billable_weight_kg),
            "total_volume_m3": float(self.tariff.total_volume_m3),
        }


def build_merchant_source_comment(*, shop: ShopModel, phone: str | None = None) -> str:
    sector = shop.market_zone or shop.section or DEFAULT_MARKET_NAME
    block = shop.block_sector or shop.floor or "—"
    rasta = shop.stall_number or "—"
    contact = phone or shop.owner_phone or ""
    return f"Bozorliii | {shop.name} | {sector}, {block}, rasta {rasta} | {contact}"


def _normalize_phone_e164(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("998") and len(digits) >= 12:
        return f"+{digits[:12]}"
    if len(digits) == 9:
        return f"+998{digits}"
    if phone.strip().startswith("+"):
        return phone.strip()
    raise BtsDeliveryError("invalid_customer_phone")


def _shop_coords(shop: ShopModel) -> tuple[float, float]:
    lat = shop.latitude
    lng = shop.longitude
    if lat is None or lng is None:
        map_x, map_y = resolve_map_coordinates(shop)
        lat, lng = resolve_wgs84_coordinates(shop, map_x, map_y)
    return float(lat), float(lng)


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return r * 2 * math.asin(math.sqrt(a))


class BtsDeliveryService:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._client = BtsDeliveryClient(self._settings)

    @property
    def is_configured(self) -> bool:
        return self._client.is_configured

    def estimate_delivery_uzs(
        self,
        *,
        tariff: TariffDecision,
        shop_lat: float,
        shop_lng: float,
        dest_lat: float,
        dest_lng: float,
    ) -> int:
        km = _haversine_km(shop_lat, shop_lng, dest_lat, dest_lng)
        base = int(self._settings.finance_delivery_base_uzs)
        per_km = int(self._settings.finance_delivery_uzs_per_km)
        weight_surcharge = int(float(tariff.billable_weight_kg) * 1_500)
        cargo_surcharge = 15_000 if tariff.carrier_class == "cargo" else 0
        amount = base + int(km * per_km) + weight_surcharge + cargo_surcharge
        return max(int(self._settings.finance_delivery_fallback_uzs), amount)

    async def _resolve_quote_cost(
        self,
        *,
        tariff: TariffDecision,
        shop_lat: float,
        shop_lng: float,
        dest_lat: float,
        dest_lng: float,
        lines: list,
    ) -> int:
        fallback = self.estimate_delivery_uzs(
            tariff=tariff,
            shop_lat=shop_lat,
            shop_lng=shop_lng,
            dest_lat=dest_lat,
            dest_lng=dest_lng,
        )
        if not self._client.is_configured:
            return fallback
        city_code = (self._settings.bts_default_city_code or "0101").strip()
        weight = max(0.1, float(tariff.billable_weight_kg))
        vol_line = lines[0] if lines else None
        volume = (
            (
                float(getattr(vol_line, "length_cm", 30) or 30),
                float(getattr(vol_line, "width_cm", 30) or 30),
                float(getattr(vol_line, "height_cm", 10) or 10),
            )
            if vol_line
            else (30.0, 30.0, 10.0)
        )
        bts_cost = await self._client.calculate_cost(
            sender_city_code=city_code,
            receiver_city_code=city_code,
            weight_kg=weight,
            volume_cm=volume,
        )
        if bts_cost and bts_cost > 0:
            return max(int(self._settings.finance_delivery_fallback_uzs), int(bts_cost))
        return fallback

    async def quote_delivery_options(
        self,
        *,
        shop: ShopModel,
        products: list[ProductModel],
        quantities: dict[str, int],
        customer_phone: str,
        destination_address: str,
        destination_lat: float,
        destination_lng: float,
        destination_city: str = "Toshkent",
    ) -> list[DeliveryQuoteOption]:
        del customer_phone, destination_address, destination_city
        lines = [product_physics(p, quantities[str(p.id)]) for p in products]
        tariff = compute_tariff_from_lines(lines)
        shop_lat, shop_lng = _shop_coords(shop)
        cost = await self._resolve_quote_cost(
            tariff=tariff,
            shop_lat=shop_lat,
            shop_lng=shop_lng,
            dest_lat=destination_lat,
            dest_lng=destination_lng,
            lines=lines,
        )
        options: list[DeliveryQuoteOption] = []
        for carrier, label in (
            ("express", "BTS tezkor kuryer"),
            ("cargo", "BTS yuk tashish"),
        ):
            if carrier == "cargo" and tariff.carrier_class != "cargo":
                continue
            adj = cost if carrier == tariff.carrier_class else cost + (8_000 if carrier == "cargo" else 0)
            options.append(
                DeliveryQuoteOption(
                    carrier_class=carrier,
                    label_uz=label,
                    delivery_cost_uzs=adj,
                    eta_minutes=45 if carrier == "cargo" else 35,
                    offer_payload=None,
                    tariff=tariff,
                )
            )
        if not options:
            options.append(
                DeliveryQuoteOption(
                    carrier_class=tariff.carrier_class,
                    label_uz="BTS yetkazish",
                    delivery_cost_uzs=cost,
                    eta_minutes=35,
                    offer_payload=None,
                    tariff=tariff,
                )
            )
        return options

    def _build_order_payload(
        self,
        *,
        client_id: str,
        shop: ShopModel,
        product: ProductModel,
        quantity: int,
        customer_phone: str,
        customer_name: str,
        destination_address: str,
        destination_lat: float,
        destination_lng: float,
        estimate_cost_uzs: int,
    ) -> dict[str, Any]:
        shop_lat, shop_lng = _shop_coords(shop)
        line = product_physics(product, quantity)
        weight = max(0.1, float(line.line_weight_kg))
        goods_value = int(product.price) * quantity
        city_code = (self._settings.bts_default_city_code or "0101").strip()

        return {
            "clientId": client_id,
            "pickup_type": "courier",
            "dropoff_type": "courier",
            "is_sender_location": True,
            "is_receiver_location": True,
            "sender": {
                "name": shop.name[:80],
                "phone": _normalize_phone_e164(shop.owner_phone or ""),
                "address": build_merchant_source_comment(shop=shop),
                "latitude": shop_lat,
                "longitude": shop_lng,
                "city_code": city_code,
            },
            "receiver": {
                "name": customer_name[:80] or "Mijoz",
                "phone": _normalize_phone_e164(customer_phone),
                "address": destination_address[:250],
                "latitude": destination_lat,
                "longitude": destination_lng,
                "city_code": city_code,
            },
            "cargo": {
                "weight": round(weight, 3),
                "volume": 0,
                "piece": max(1, quantity),
                "packageId": int(self._settings.bts_package_id or 4),
                "postTypeId": int(self._settings.bts_post_type_id or 26),
                "postTypes": [
                    {
                        "name": product.name[:60],
                        "code": str(product.id).replace("-", "")[:12].upper() or "BOZOR",
                        "count": quantity,
                        "cost": goods_value,
                    }
                ],
            },
            "ready_to_take": True,
            "_estimate_cost_uzs": estimate_cost_uzs,
        }

    async def create_shipment_for_order(
        self,
        *,
        order_id: UUID,
        shop: ShopModel,
        product: ProductModel,
        quantity: int,
        customer_phone: str,
        destination_address: str,
        destination_lat: float,
        destination_lng: float,
        delivery_cost_uzs: int,
        extra_products: list[tuple[ProductModel, int]] | None = None,
    ) -> dict[str, Any]:
        payload = self._build_order_payload(
            client_id=str(order_id),
            shop=shop,
            product=product,
            quantity=quantity,
            customer_phone=customer_phone,
            customer_name="Mijoz",
            destination_address=destination_address,
            destination_lat=destination_lat,
            destination_lng=destination_lng,
            estimate_cost_uzs=delivery_cost_uzs,
        )
        if extra_products:
            post_types = list(payload["cargo"]["postTypes"])
            for ep, eq in extra_products:
                post_types.append(
                    {
                        "name": ep.name[:60],
                        "code": str(ep.id).replace("-", "")[:12].upper() or "BOZOR",
                        "count": eq,
                        "cost": int(ep.price) * eq,
                    }
                )
            payload["cargo"]["postTypes"] = post_types
            payload["cargo"]["piece"] = sum(int(x["count"]) for x in post_types)

        try:
            resp = await self._client.create_order(payload)
        except BtsDeliveryAPIError as exc:
            raise BtsDeliveryError(str(exc)) from exc

        data = resp.get("data") if isinstance(resp.get("data"), dict) else resp
        bts_order_id = str(data.get("orderId") or data.get("order_id") or "")
        if not bts_order_id:
            raise BtsDeliveryError("bts_order_id_missing")

        cost = int(data.get("cost") or delivery_cost_uzs or 0)
        return {
            "bts_order_id": bts_order_id,
            "barcode": str(data.get("barcode") or ""),
            "tracking_url": str(data.get("tracking") or ""),
            "price_uzs": cost,
            "mapped_status": "accepted",
            "source_comment": build_merchant_source_comment(shop=shop),
            "raw": data,
        }

    async def get_shipment_info(self, bts_order_id: str) -> dict[str, Any]:
        try:
            return await self._client.track_order(bts_order_id)
        except BtsDeliveryAPIError as exc:
            raise BtsDeliveryError(str(exc)) from exc

    @staticmethod
    def map_bts_status_to_claim(*, status_code: str, status_name: str) -> str:
        name = (status_name or "").lower()
        code = str(status_code or "").strip()
        delivered_tokens = ("yetkazildi", "delivered", "получ", "qabul qilindi", "вручен")
        cancelled_tokens = ("bekor", "cancel", "отмен")
        picked_tokens = ("yo'lda", "в пути", "picked", "kuryer")
        if any(t in name for t in delivered_tokens) or code in {"500", "600", "700"}:
            return "delivered"
        if any(t in name for t in cancelled_tokens) or code in {"900", "999"}:
            return "cancelled"
        if any(t in name for t in picked_tokens):
            return "picked_up"
        if code:
            return "accepted"
        return "searching"
