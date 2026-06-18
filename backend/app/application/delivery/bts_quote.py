"""BTS yetkazish narxi — billing split uchun."""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from loguru import logger

from app.core.config import Settings, get_settings
from app.infrastructure.db.models import OrderModel, ShopModel

UZS_QUANT = Decimal("0.01")


def _to_decimal(value: Any) -> Decimal:
    return Decimal(str(value)).quantize(UZS_QUANT)


class BtsDeliveryQuoteEngine:
    """delivery_share — billing_payload, order.delivery_cost_uzs yoki fallback."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()

    async def quote_delivery_uzs(
        self,
        *,
        order: OrderModel,
        shop: ShopModel | None,
        billing_payload: dict[str, Any],
        session: Any = None,
    ) -> Decimal:
        del shop, session

        if "delivery_share_uzs" in billing_payload:
            return max(Decimal("0.00"), _to_decimal(billing_payload["delivery_share_uzs"]))

        for key in ("bts_quote_uzs", "yandex_quote_uzs"):
            if key in billing_payload:
                return max(Decimal("0.00"), _to_decimal(billing_payload[key]))

        fulfillment = (order.fulfillment_type or "delivery").strip().lower()
        if fulfillment != "delivery":
            return Decimal("0.00")

        if order.delivery_cost_uzs:
            amount = _to_decimal(order.delivery_cost_uzs)
            logger.bind(order_id=str(order.id), amount_uzs=str(amount)).info("delivery_share from order")
            return amount

        fallback = _to_decimal(self._settings.finance_delivery_fallback_uzs)
        logger.bind(order_id=str(order.id), amount_uzs=str(fallback)).warning("delivery_share fallback")
        return fallback
