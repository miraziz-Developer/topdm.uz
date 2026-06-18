"""Merchant dispatch — BTS Express: create order → track."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.delivery.bts_delivery import BtsDeliveryError, BtsDeliveryService, build_merchant_source_comment
from app.application.marketplace.use_cases import MarketplaceUseCases
from app.core.config import get_settings
from app.infrastructure.db.models import OrderModel, ProductModel
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway
from app.infrastructure.repositories.delivery_repo import DeliveryRepository
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.models.delivery_claim import DeliveryClaimStatus


class DeliveryDispatchService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._delivery_repo = DeliveryRepository(session)
        self._marketplace = MarketplaceRepository(session)
        self._bts = BtsDeliveryService()

    async def _load_bundle_products(self, claim_meta: dict) -> list[tuple[ProductModel, int]]:
        extras: list[tuple[ProductModel, int]] = []
        bundle = claim_meta.get("bundle_lines") or []
        if not isinstance(bundle, list):
            return extras
        for row in bundle[1:]:
            if not isinstance(row, dict):
                continue
            pid = row.get("product_id")
            qty = int(row.get("quantity") or 1)
            if not pid:
                continue
            product = await self._session.get(ProductModel, UUID(str(pid)))
            if product:
                extras.append((product, qty))
        return extras

    async def dispatch_order_to_courier(self, *, shop_id: UUID, order_id: UUID) -> dict[str, Any]:
        order = await self._marketplace.get_order_by_id(order_id)
        if not order or order.shop_id != shop_id:
            raise ValueError("order_not_found")
        if (order.fulfillment_type or "").lower() != "delivery":
            raise ValueError("not_delivery_order")

        claim = await self._delivery_repo.get_claim_by_order_for_update(order_id)
        if claim is None:
            raise ValueError("delivery_claim_not_found")

        shop = await self._marketplace.get_shop(shop_id)
        if not shop:
            raise ValueError("shop_not_found")

        product = await self._session.get(ProductModel, order.product_id)
        if not product:
            raise ValueError("product_not_found")

        if not order.delivery_lat or not order.delivery_lng or not order.delivery_address:
            raise ValueError("delivery_address_missing")

        bts_order_id = claim.yandex_claim_id

        if not bts_order_id:
            extras = await self._load_bundle_products(claim.meta or {})
            pipeline = await self._bts.create_shipment_for_order(
                order_id=order_id,
                shop=shop,
                product=product,
                quantity=int(order.quantity),
                customer_phone=order.customer_phone,
                destination_address=order.delivery_address,
                destination_lat=float(order.delivery_lat),
                destination_lng=float(order.delivery_lng),
                delivery_cost_uzs=int(claim.delivery_cost or order.delivery_cost_uzs or 0),
                extra_products=extras or None,
            )
            bts_order_id = pipeline["bts_order_id"]
            await self._delivery_repo.attach_bts_order(
                claim,
                bts_order_id=bts_order_id,
                status=DeliveryClaimStatus.ACCEPTED.value,
                meta_patch={
                    "pipeline_price_uzs": pipeline.get("price_uzs"),
                    "barcode": pipeline.get("barcode"),
                    "tracking_url": pipeline.get("tracking_url"),
                    "source_comment": build_merchant_source_comment(shop=shop),
                    "provider": "bts",
                },
            )
            if int(claim.delivery_cost or 0) == 0 and pipeline.get("price_uzs"):
                claim.delivery_cost = pipeline["price_uzs"]
        else:
            await self._delivery_repo.update_claim_status(
                claim,
                status=DeliveryClaimStatus.ACCEPTED.value,
                accepted=True,
            )

        if order.status == "reserved":
            await self._marketplace.update_order_status(
                shop_id=shop_id,
                order_id=order_id,
                status="preparing",
            )
        await self._session.commit()

        return {
            "order_id": str(order_id),
            "claim_id": str(claim.id),
            "bts_order_id": bts_order_id,
            "status": claim.status,
            "source_comment": build_merchant_source_comment(shop=shop),
            "provider": "bts",
        }

    async def get_waybill(self, *, shop_id: UUID, order_id: UUID) -> dict[str, Any]:
        order = await self._marketplace.get_order_by_id(order_id)
        if not order or order.shop_id != shop_id:
            raise ValueError("order_not_found")

        stmt = (
            select(OrderModel)
            .options(
                selectinload(OrderModel.product),
                selectinload(OrderModel.shop),
            )
            .where(OrderModel.id == order_id)
        )
        result = await self._session.execute(stmt)
        order_loaded = result.scalar_one_or_none()
        if not order_loaded:
            raise ValueError("order_not_found")

        claim = await self._delivery_repo.get_claim_by_order(order_id)
        shop = order_loaded.shop
        product = order_loaded.product
        meta = (claim.meta or {}) if claim else {}

        sector = (shop.market_zone or shop.section or "—") if shop else "—"
        block = (shop.block_sector or shop.floor or "—") if shop else "—"
        rasta = (shop.stall_number or "—") if shop else "—"

        return {
            "order_id": str(order_id),
            "barcode_value": str(meta.get("barcode") or str(order_id).replace("-", "")[:16].upper()),
            "merchant": {
                "name": shop.name if shop else "",
                "sector": sector,
                "block": block,
                "rasta": rasta,
                "phone": shop.owner_phone if shop else "",
            },
            "customer": {
                "phone": order_loaded.customer_phone,
                "address": order_loaded.delivery_address or "",
                "city": order_loaded.delivery_city or "Toshkent",
            },
            "product": {
                "name": product.name if product else "",
                "quantity": order_loaded.quantity,
            },
            "carrier_class": order_loaded.carrier_class or "express",
            "delivery_cost_uzs": int(order_loaded.delivery_cost_uzs or 0),
            "claim_status": claim.status if claim else "draft",
            "bts_order_id": claim.yandex_claim_id if claim else None,
            "tracking_url": meta.get("tracking_url"),
            "provider": "bts",
        }

    async def sync_claim_status(self, *, shop_id: UUID, order_id: UUID) -> dict[str, Any]:
        claim = await self._delivery_repo.get_claim_by_order_for_update(order_id)
        if not claim or claim.shop_id != shop_id:
            raise ValueError("delivery_claim_not_found")
        if not claim.yandex_claim_id:
            raise ValueError("bts_order_missing")

        info = await self._bts.get_shipment_info(claim.yandex_claim_id)
        mapped = self._bts.map_bts_status_to_claim(
            status_code=str(info.get("status_code") or ""),
            status_name=str(info.get("status_name") or ""),
        )
        delivered = mapped == DeliveryClaimStatus.DELIVERED.value
        await self._delivery_repo.update_claim_status(
            claim,
            status=mapped,
            delivered=delivered,
        )
        if delivered:
            from app.application.delivery.bundle_completion import complete_delivery_bundle

            await complete_delivery_bundle(self._session, claim=claim)
        await self._session.commit()
        return {"order_id": str(order_id), "status": mapped, "bts": info, "provider": "bts"}

    async def activate_courier_after_payment(self, order_id: UUID) -> dict[str, Any] | None:
        order = await self._marketplace.get_order_by_id(order_id)
        if not order or (order.fulfillment_type or "").lower() != "delivery":
            return None
        try:
            return await self.dispatch_order_to_courier(shop_id=order.shop_id, order_id=order_id)
        except ValueError as exc:
            from loguru import logger

            logger.bind(order_id=str(order_id), reason=str(exc)).error("bts_dispatch_failed")
            return {"order_id": str(order_id), "dispatch_error": str(exc), "provider": "bts"}

    async def cancel_delivery(self, *, shop_id: UUID, order_id: UUID) -> dict[str, Any]:
        claim = await self._delivery_repo.get_claim_by_order_for_update(order_id)
        if not claim or claim.shop_id != shop_id:
            raise ValueError("delivery_claim_not_found")
        await self._delivery_repo.update_claim_status(claim, status=DeliveryClaimStatus.CANCELLED.value)
        await self._session.commit()
        return {
            "order_id": str(order_id),
            "bts_order_id": claim.yandex_claim_id,
            "status": "cancelled",
            "note": "BTS bekor qilish API orqali qo'llab-quvvatlash xizmati orqali",
        }
