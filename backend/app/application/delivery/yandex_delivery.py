"""Checkout + dispatch facade over YandexDeliveryGateway."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from app.application.delivery.tariff_splitter import (
    TariffDecision,
    compute_tariff_from_lines,
    product_physics,
)
from app.core.config import Settings, get_settings
from app.infrastructure.db.models import OrderModel, ProductModel, ShopModel
from app.services.yandex_delivery import (
    CartItemMetrics,
    CartMetrics,
    YandexDeliveryAPIError,
    YandexDeliveryGateway,
    build_bazaar_source_comment,
)

DEFAULT_MARKET_NAME = "Ippodrom"


class YandexDeliveryError(ValueError):
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
            "billable_weight_kg": float(self.tariff.billable_weight_kg),
            "total_volume_m3": float(self.tariff.total_volume_m3),
        }


def build_merchant_source_comment(*, shop: ShopModel, phone: str | None = None) -> str:
    return build_bazaar_source_comment(_shop_to_merchant_dict(shop, phone=phone))


def _shop_to_merchant_dict(shop: ShopModel, *, phone: str | None = None) -> dict[str, Any]:
    if shop.latitude is None or shop.longitude is None:
        raise YandexDeliveryError("shop_coordinates_missing")
    return {
        "sector": shop.market_zone or shop.section or "",
        "block": shop.block_sector or shop.floor or "",
        "rasta": shop.stall_number or "",
        "phone": phone or shop.owner_phone or "",
        "coordinates": [float(shop.longitude), float(shop.latitude)],
        "name": shop.name,
        "city": "Toshkent",
    }


class YandexDeliveryService:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._gateway = YandexDeliveryGateway(self._settings)

    @property
    def is_configured(self) -> bool:
        return self._gateway.is_configured

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
        lines = [product_physics(p, quantities[str(p.id)]) for p in products]
        tariff = compute_tariff_from_lines(lines)
        merchant = _shop_to_merchant_dict(shop)
        customer = {
            "phone": customer_phone,
            "address": destination_address,
            "coordinates": [float(destination_lng), float(destination_lat)],
            "city": destination_city,
        }
        cart = self._cart_from_lines(lines, products, quantities)

        estimate = await self._gateway.calculate_shipping_estimate(
            float(tariff.total_weight_kg),
            float(tariff.total_volume_m3),
            merchant["coordinates"],
            customer["coordinates"],
            merchant_data=merchant,
            customer_data=customer,
            cart_items=cart.items,
        )

        carrier = str(estimate.get("carrier_class") or tariff.carrier_class)
        return [
            DeliveryQuoteOption(
                carrier_class=carrier,
                label_uz="Yuk mashinasi (Yandex)" if carrier == "cargo" else "Tezkor kuryer (Yandex)",
                delivery_cost_uzs=int(estimate["delivery_cost_uzs"]),
                eta_minutes=int(estimate.get("eta_minutes") or 35),
                offer_payload=None,
                tariff=tariff,
            )
        ]

    async def initialize_pipeline_for_order(
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
        destination_city: str,
        offer_payload: str | None = None,
        request_id: str | None = None,
    ) -> dict[str, Any]:
        lines = [product_physics(product, quantity)]
        tariff = compute_tariff_from_lines(lines)
        merchant = _shop_to_merchant_dict(shop)
        customer = {
            "phone": customer_phone,
            "address": destination_address,
            "coordinates": [float(destination_lng), float(destination_lat)],
            "city": destination_city,
        }
        cart = self._cart_from_lines(lines, [product], {str(product.id): quantity})
        try:
            return await self._gateway.create_delivery_claim(
                str(order_id),
                merchant,
                customer,
                cart_metrics=cart,
                request_id=request_id,
                offer_payload=offer_payload,
            )
        except YandexDeliveryAPIError as exc:
            raise YandexDeliveryError(str(exc)) from exc

    async def dispatch_courier_search(self, claim_id: str, *, version: int | None = None) -> dict[str, Any]:
        try:
            locked = await self._gateway.accept_and_lock_claim(claim_id, version=version)
        except YandexDeliveryAPIError as exc:
            raise YandexDeliveryError(str(exc)) from exc
        return {"claim_id": claim_id, "status": "accepted" if locked else "pending", "locked": locked}

    async def get_claim_info(self, claim_id: str) -> dict[str, Any]:
        try:
            return await self._gateway.get_claim_info(claim_id)
        except YandexDeliveryAPIError as exc:
            raise YandexDeliveryError(str(exc)) from exc

    async def terminate_claim(self, claim_id: str) -> dict[str, Any]:
        try:
            return await self._gateway.terminate_active_claim(claim_id)
        except YandexDeliveryAPIError as exc:
            raise YandexDeliveryError(str(exc)) from exc

    @staticmethod
    def map_yandex_status_to_claim(status: str) -> str:
        return YandexDeliveryGateway.map_yandex_status(status)

    def _cart_from_lines(
        self,
        lines: list,
        products: list[ProductModel],
        quantities: dict[str, int],
    ) -> CartMetrics:
        product_map = {str(p.id): p for p in products}
        items: list[CartItemMetrics] = []
        for line in lines:
            product = product_map[line.product_id]
            items.append(
                CartItemMetrics(
                    title=product.name,
                    quantity=line.quantity,
                    weight_kg=float(line.weight_kg),
                    length_m=float(line.length_cm) / 100,
                    width_m=float(line.width_cm) / 100,
                    height_m=float(line.height_cm) / 100,
                    cost_value_uzs=int(product.price) * line.quantity,
                )
            )
        tariff = compute_tariff_from_lines(lines)
        return CartMetrics(items=items, is_heavy=tariff.carrier_class == "cargo")
