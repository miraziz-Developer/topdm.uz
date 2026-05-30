"""Customer delivery quote + order reservation."""
from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.delivery.tariff_splitter import compute_tariff_from_lines, product_physics
from app.application.delivery.yandex_delivery import YandexDeliveryService
from app.infrastructure.db.models import ProductModel
from app.services.inventory import reserve_delivery_line_locked


class DeliveryCheckoutService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._yandex = YandexDeliveryService()

    async def quote_cart(
        self,
        *,
        items: list[dict[str, Any]],
        customer_phone: str,
        destination_address: str,
        destination_lat: float,
        destination_lng: float,
        destination_city: str = "Toshkent",
    ) -> dict[str, Any]:
        product_ids = [UUID(str(i["product_id"])) for i in items]
        qty_map = {str(i["product_id"]): int(i["quantity"]) for i in items}

        result = await self._session.execute(
            select(ProductModel)
            .options(selectinload(ProductModel.shop))
            .where(ProductModel.id.in_(product_ids))
        )
        products = list(result.scalars().all())
        if len(products) != len(product_ids):
            raise ValueError("product_not_found")

        shop_ids = {p.shop_id for p in products}
        if len(shop_ids) != 1:
            raise ValueError("single_shop_required_for_delivery")

        shop = products[0].shop
        if shop is None:
            raise ValueError("shop_not_found")

        lines = [product_physics(p, qty_map[str(p.id)]) for p in products]
        tariff = compute_tariff_from_lines(lines)

        options = await self._yandex.quote_delivery_options(
            shop=shop,
            products=products,
            quantities=qty_map,
            customer_phone=customer_phone,
            destination_address=destination_address,
            destination_lat=destination_lat,
            destination_lng=destination_lng,
            destination_city=destination_city,
        )

        product_subtotal = sum(int(p.price) * qty_map[str(p.id)] for p in products)
        recommended = next((o for o in options if o.carrier_class == tariff.carrier_class), options[0])

        return {
            "shop_id": str(shop.id),
            "shop_name": shop.name,
            "product_subtotal_uzs": product_subtotal,
            "recommended_carrier": tariff.carrier_class,
            "tariff": {
                "total_weight_kg": float(tariff.total_weight_kg),
                "total_volume_m3": float(tariff.total_volume_m3),
                "billable_weight_kg": float(tariff.billable_weight_kg),
            },
            "options": [o.to_dict() for o in options],
            "recommended": recommended.to_dict(),
            "total_payable_uzs": product_subtotal + recommended.delivery_cost_uzs,
        }

    async def reserve_delivery_order(
        self,
        *,
        items: list[dict[str, Any]],
        customer_phone: str,
        customer_email: str | None,
        payment_method: str,
        note: str | None,
        ref_token: str | None,
        destination_address: str,
        destination_lat: float,
        destination_lng: float,
        destination_city: str,
        carrier_class: str,
        delivery_cost_uzs: int,
        delivery_eta_minutes: int | None,
        offer_payload: str | None,
    ) -> dict[str, Any]:
        quote = await self.quote_cart(
            items=items,
            customer_phone=customer_phone,
            destination_address=destination_address,
            destination_lat=destination_lat,
            destination_lng=destination_lng,
            destination_city=destination_city,
        )

        selected = next((o for o in quote["options"] if o["carrier_class"] == carrier_class), None)
        if not selected:
            raise ValueError("invalid_carrier_class")
        if int(selected["delivery_cost_uzs"]) != int(delivery_cost_uzs):
            raise ValueError("delivery_cost_mismatch")

        reservations: list[dict[str, Any]] = []
        total_product = 0

        from app.infrastructure.repositories.delivery_repo import DeliveryRepository

        delivery_repo = DeliveryRepository(self._session)

        async with self._session.begin():
            for item in items:
                pid = UUID(str(item["product_id"]))
                qty = int(item["quantity"])
                line_note = f"Yetkazish: {destination_address} | To'lov: {payment_method}"
                if note:
                    line_note = f"{note.strip()} | {line_note}"

                line = await reserve_delivery_line_locked(
                    self._session,
                    product_id=pid,
                    quantity=qty,
                    customer_phone=customer_phone,
                    customer_email=customer_email,
                    note=line_note,
                    ref_token=ref_token,
                    destination_address=destination_address,
                    destination_city=destination_city,
                    destination_lat=destination_lat,
                    destination_lng=destination_lng,
                    carrier_class=carrier_class,
                    delivery_cost_uzs=int(delivery_cost_uzs),
                    delivery_eta_minutes=delivery_eta_minutes,
                    status="reserved",
                )
                order = line.order
                line_total = int(order.total_price)
                total_product += line_total
                reservations.append(
                    {
                        "order_id": str(order.id),
                        "product_id": str(pid),
                        "shop_id": str(line.shop.id),
                        "quantity": qty,
                        "total_price": float(line_total),
                        "status": order.status,
                    }
                )
                await delivery_repo.create_claim(
                    order_id=order.id,
                    shop_id=line.shop.id,
                    carrier_class=carrier_class,
                    delivery_cost=Decimal(str(delivery_cost_uzs)),
                    eta_minutes=delivery_eta_minutes,
                    offer_payload=offer_payload,
                    meta={"destination": destination_address},
                )

        return {
            "reservations": reservations,
            "reservation_count": len(reservations),
            "product_subtotal_uzs": total_product,
            "delivery_cost_uzs": int(delivery_cost_uzs),
            "total_payable_uzs": total_product + int(delivery_cost_uzs),
            "carrier_class": carrier_class,
            "fulfillment_type": "delivery",
            "delivery_eta_minutes": delivery_eta_minutes,
            "quote_snapshot": quote,
        }
