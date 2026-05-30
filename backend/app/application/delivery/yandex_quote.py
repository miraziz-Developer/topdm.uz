"""Yandex Delivery quotation layer for order split calculations."""
from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

import httpx
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.infrastructure.db.models import OrderModel, ShopModel

UZS_QUANT = Decimal("0.01")


def _to_decimal(value: Any) -> Decimal:
    return Decimal(str(value)).quantize(UZS_QUANT)


class YandexDeliveryQuoteEngine:
    """
    Resolves delivery_share for a paid order.

    Priority:
    1. billing_payload.delivery_share_uzs (gateway-confirmed)
    2. billing_payload.yandex_quote_uzs
    3. Live Yandex Router API (when configured)
    4. Config fallback flat rate (pickup orders => 0)
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()

    async def quote_delivery_uzs(
        self,
        *,
        order: OrderModel,
        shop: ShopModel | None,
        billing_payload: dict[str, Any],
        session: AsyncSession | None = None,
    ) -> Decimal:
        del session  # reserved for future geo lookups

        if "delivery_share_uzs" in billing_payload:
            amount = _to_decimal(billing_payload["delivery_share_uzs"])
            logger.bind(
                event="delivery_quote",
                source="billing_payload",
                order_id=str(order.id),
                amount_uzs=str(amount),
            ).info("delivery_share resolved from billing payload")
            return max(Decimal("0.00"), amount)

        if "yandex_quote_uzs" in billing_payload:
            amount = _to_decimal(billing_payload["yandex_quote_uzs"])
            logger.bind(
                event="delivery_quote",
                source="yandex_payload",
                order_id=str(order.id),
                amount_uzs=str(amount),
            ).info("delivery_share resolved from yandex_quote_uzs")
            return max(Decimal("0.00"), amount)

        fulfillment = (order.fulfillment_type or "delivery").strip().lower()
        if fulfillment != "delivery":
            logger.bind(event="delivery_quote", source="pickup", order_id=str(order.id)).info(
                "delivery_share zero for non-delivery fulfillment"
            )
            return Decimal("0.00")

        api_amount = await self._fetch_yandex_router_quote(order=order, shop=shop, billing_payload=billing_payload)
        if api_amount is not None:
            return api_amount

        fallback = _to_decimal(self._settings.finance_delivery_fallback_uzs)
        logger.bind(
            event="delivery_quote",
            source="fallback",
            order_id=str(order.id),
            amount_uzs=str(fallback),
        ).warning("using finance_delivery_fallback_uzs for delivery_share")
        return fallback

    async def _fetch_yandex_router_quote(
        self,
        *,
        order: OrderModel,
        shop: ShopModel | None,
        billing_payload: dict[str, Any],
    ) -> Decimal | None:
        api_key = (self._settings.yandex_router_api_key or "").strip()
        if not api_key:
            return None

        dest_lat = billing_payload.get("destination_lat") or billing_payload.get("customer_lat")
        dest_lng = billing_payload.get("destination_lng") or billing_payload.get("customer_lng")
        if dest_lat is None or dest_lng is None or shop is None:
            return None
        if shop.latitude is None or shop.longitude is None:
            return None

        try:
            async with httpx.AsyncClient(timeout=self._settings.external_api_timeout_seconds) as client:
                # Placeholder integration point — extend with your Yandex Delivery tariff endpoint.
                response = await client.get(
                    "https://api.routing.yandex.net/v2/distancematrix",
                    params={
                        "apikey": api_key,
                        "origins": f"{shop.longitude},{shop.latitude}",
                        "destinations": f"{dest_lng},{dest_lat}",
                        "mode": "driving",
                    },
                )
                if response.status_code >= 400:
                    logger.bind(
                        event="delivery_quote",
                        source="yandex_api",
                        order_id=str(order.id),
                        status_code=response.status_code,
                    ).warning("yandex router quote failed")
                    return None
                data = response.json()
                meters = self._extract_distance_meters(data)
                if meters is None:
                    return None
                rate_per_km = _to_decimal(self._settings.finance_delivery_uzs_per_km)
                base = _to_decimal(self._settings.finance_delivery_base_uzs)
                km = Decimal(meters) / Decimal("1000")
                amount = (base + (km * rate_per_km)).quantize(UZS_QUANT)
                logger.bind(
                    event="delivery_quote",
                    source="yandex_api",
                    order_id=str(order.id),
                    meters=meters,
                    amount_uzs=str(amount),
                ).info("delivery_share from yandex distance matrix")
                return max(Decimal("0.00"), amount)
        except Exception as exc:
            logger.bind(event="delivery_quote", source="yandex_api", order_id=str(order.id), error=str(exc)).exception(
                "yandex quote exception"
            )
            return None

    @staticmethod
    def _extract_distance_meters(payload: dict[str, Any]) -> int | None:
        rows = payload.get("rows") or []
        if not rows:
            return None
        elements = (rows[0] or {}).get("elements") or []
        if not elements:
            return None
        distance = (elements[0] or {}).get("distance") or {}
        value = distance.get("value")
        return int(value) if value is not None else None
