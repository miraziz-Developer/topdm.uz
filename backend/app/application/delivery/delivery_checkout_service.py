"""Customer delivery quote + order reservation."""
from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.delivery.tariff_splitter import compute_tariff_from_lines, product_physics
from app.application.delivery.bts_delivery import BtsDeliveryService
from app.core.config import get_settings
from app.infrastructure.db.models import ProductModel
from app.schemas.orders import PaymentMethod
from app.services.inventory import InventoryError, reserve_delivery_line_locked

logger = logging.getLogger(__name__)

ONLINE_PAYMENT_METHODS = frozenset({PaymentMethod.click})


class DeliveryCheckoutService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._bts = BtsDeliveryService()

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

        options = await self._bts.quote_delivery_options(
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
        customer_user_id: UUID | None = None,
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
        bundle_lines: list[dict[str, Any]] = []
        total_product = 0

        from app.infrastructure.repositories.delivery_repo import DeliveryRepository

        delivery_repo = DeliveryRepository(self._session)

        try:
            for idx, item in enumerate(items):
                pid = UUID(str(item["product_id"]))
                qty = int(item["quantity"])
                variant_color = str(item.get("color") or "").strip() or None
                variant_size = str(item.get("size") or "").strip() or None
                line_note = f"Yetkazish: {destination_address} | To'lov: {payment_method}"
                if note:
                    line_note = f"{note.strip()} | {line_note}"
                variant_bits: list[str] = []
                if variant_color:
                    variant_bits.append(f"Rang: {variant_color}")
                if variant_size:
                    variant_bits.append(f"Razmer: {variant_size}")
                if variant_bits:
                    line_note = f"{' | '.join(variant_bits)} | {line_note}"

                line_delivery_cost = int(delivery_cost_uzs) if idx == 0 else 0

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
                    delivery_cost_uzs=line_delivery_cost,
                    delivery_eta_minutes=delivery_eta_minutes,
                    payment_method=payment_method,
                    variant_color=variant_color,
                    variant_size=variant_size,
                    status="reserved",
                    customer_user_id=customer_user_id,
                )
                order = line.order
                line_total = int(order.total_price)
                total_product += line_total
                bundle_lines.append({"product_id": str(pid), "quantity": qty, "order_id": str(order.id)})
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

            if reservations:
                primary = reservations[0]
                await delivery_repo.create_claim(
                    order_id=UUID(primary["order_id"]),
                    shop_id=UUID(primary["shop_id"]),
                    carrier_class=carrier_class,
                    delivery_cost=Decimal(str(delivery_cost_uzs)),
                    eta_minutes=delivery_eta_minutes,
                    offer_payload=offer_payload,
                    meta={
                        "destination": destination_address,
                        "bundle_lines": bundle_lines,
                        "provider": "bts",
                    },
                )

            checkout_id: str | None = None
            online_url: str | None = None
            settings = get_settings()
            try:
                pay_method = PaymentMethod(str(payment_method).strip().lower())
            except ValueError:
                pay_method = None
            if (
                settings.enable_online_checkout
                and pay_method in ONLINE_PAYMENT_METHODS
                and reservations
            ):
                from app.application.payments.order_payment_service import OrderPaymentService

                order_uuids = [UUID(r["order_id"]) for r in reservations]
                pay_svc = OrderPaymentService(self._session, settings)
                total_payable = total_product + int(delivery_cost_uzs)
                checkout = await pay_svc.create_checkout_for_orders(
                    order_ids=order_uuids,
                    amount_uzs=total_payable,
                    provider=pay_method.value,
                    customer_phone=customer_phone,
                    extra_amount_uzs=int(delivery_cost_uzs),
                )
                checkout_id = str(checkout.id)
                if (
                    pay_method == PaymentMethod.click
                    and settings.click_hosted_checkout
                    and (settings.click_merchant_id or "").strip()
                ):
                    from app.application.payments.click_merchant_api import build_click_pay_url

                    return_base = (settings.site_url or "https://bozorliii.uz").rstrip("/")
                    online_url = build_click_pay_url(
                        amount_uzs=int(total_payable),
                        transaction_param=checkout_id,
                        return_url=f"{return_base}/orders?checkout={checkout_id}",
                        settings=settings,
                    )
                else:
                    base = (
                        settings.payment_checkout_base_url or settings.site_url or "https://bozorliii.uz"
                    ).rstrip("/")
                    online_url = (
                        f"{base}/checkout/{pay_method.value}"
                        f"?checkout_id={checkout_id}&amount={int(total_payable)}"
                    )

            await self._session.commit()

            if reservations:
                try:
                    from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway
                    from app.application.merchant.merchant_order_notify import notify_merchant_new_order
                    from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository

                    notifier = TelegramNotifierGateway(settings.telegram_bot_token)
                    mrepo = MarketplaceRepository(self._session)
                    for res in reservations:
                        order = await mrepo.get_order_by_id(UUID(res["order_id"]))
                        shop = await mrepo.get_shop(UUID(res["shop_id"]))
                        product = await mrepo.get_product_by_id(UUID(res["product_id"]))
                        if order and shop and product:
                            await notify_merchant_new_order(
                                notifier,
                                shop=shop,
                                order=order,
                                product_name=product.name,
                                fulfillment_label=f"Yetkazish · {destination_address[:80]}",
                                extra_lines=[f"🚛 {carrier_class}"],
                            )
                except Exception:
                    logger.warning("delivery_merchant_notify_failed", exc_info=True)
        except InventoryError:
            await self._session.rollback()
            raise
        except ValueError as exc:
            await self._session.rollback()
            if str(exc) in ("amount_mismatch", "order_not_found", "invalid_provider"):
                raise
            logger.warning("delivery_checkout_session_create_failed", exc_info=True)
            raise ValueError("online_checkout_failed") from exc
        except Exception:
            await self._session.rollback()
            raise

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
            "checkout_id": checkout_id,
            "online_checkout_url": online_url,
        }
