"""Merchant dispatch — Yandex pipeline: create → info → accept."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.delivery.yandex_delivery import YandexDeliveryError, YandexDeliveryService, build_merchant_source_comment
from app.infrastructure.db.models import OrderModel, ProductModel
from app.infrastructure.repositories.delivery_repo import DeliveryRepository
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.models.delivery_claim import DeliveryClaimStatus


class DeliveryDispatchService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._delivery_repo = DeliveryRepository(session)
        self._marketplace = MarketplaceRepository(session)
        self._yandex = YandexDeliveryService()

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

        yandex_claim_id = claim.yandex_claim_id
        version: int | None = None

        if not yandex_claim_id:
            pipeline = await self._yandex.initialize_pipeline_for_order(
                order_id=order_id,
                shop=shop,
                product=product,
                quantity=int(order.quantity),
                customer_phone=order.customer_phone,
                destination_address=order.delivery_address,
                destination_lat=float(order.delivery_lat),
                destination_lng=float(order.delivery_lng),
                destination_city=order.delivery_city or "Toshkent",
                offer_payload=claim.offer_payload,
                request_id=str(claim.id),
            )
            yandex_claim_id = pipeline["claim_id"]
            if pipeline.get("revision"):
                try:
                    version = int(pipeline["revision"])
                except (TypeError, ValueError):
                    version = None
            await self._delivery_repo.attach_yandex_claim(
                claim,
                yandex_claim_id=yandex_claim_id,
                yandex_revision=str(pipeline.get("revision") or "") or None,
                status=str(pipeline.get("mapped_status") or "draft"),
                meta_patch={
                    "pipeline_price_uzs": pipeline.get("price_uzs"),
                    "source_comment": build_merchant_source_comment(shop=shop),
                },
            )
            if int(claim.delivery_cost or 0) == 0 and pipeline.get("price_uzs"):
                claim.delivery_cost = pipeline["price_uzs"]

        accept_resp = await self._yandex.dispatch_courier_search(yandex_claim_id, version=version)
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
            "yandex_claim_id": yandex_claim_id,
            "status": claim.status,
            "source_comment": build_merchant_source_comment(shop=shop),
            "accept": accept_resp,
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

        sector = (shop.market_zone or shop.section or "—") if shop else "—"
        block = (shop.block_sector or shop.floor or "—") if shop else "—"
        rasta = (shop.stall_number or "—") if shop else "—"

        return {
            "order_id": str(order_id),
            "barcode_value": str(order_id).replace("-", "")[:16].upper(),
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
            "yandex_claim_id": claim.yandex_claim_id if claim else None,
        }

    async def sync_claim_status(self, *, shop_id: UUID, order_id: UUID) -> dict[str, Any]:
        claim = await self._delivery_repo.get_claim_by_order_for_update(order_id)
        if not claim or claim.shop_id != shop_id:
            raise ValueError("delivery_claim_not_found")
        if not claim.yandex_claim_id:
            raise ValueError("yandex_claim_missing")

        info = await self._yandex.get_claim_info(claim.yandex_claim_id)
        mapped = self._yandex.map_yandex_status_to_claim(str(info.get("status") or ""))
        delivered = mapped == DeliveryClaimStatus.DELIVERED.value
        await self._delivery_repo.update_claim_status(
            claim,
            status=mapped,
            delivered=delivered,
        )
        if delivered:
            await self._marketplace.update_order_status(shop_id=shop_id, order_id=order_id, status="completed")
        await self._session.commit()
        return {"order_id": str(order_id), "status": mapped, "yandex": info}

    async def activate_courier_after_payment(self, order_id: UUID) -> dict[str, Any] | None:
        """
        Post-payment hook: claims/create → info → claims/accept.
        Called when online payment is validated.
        """
        order = await self._marketplace.get_order_by_id(order_id)
        if not order or (order.fulfillment_type or "").lower() != "delivery":
            return None
        try:
            return await self.dispatch_order_to_courier(shop_id=order.shop_id, order_id=order_id)
        except ValueError:
            return None

    async def cancel_delivery(self, *, shop_id: UUID, order_id: UUID) -> dict[str, Any]:
        claim = await self._delivery_repo.get_claim_by_order_for_update(order_id)
        if not claim or claim.shop_id != shop_id:
            raise ValueError("delivery_claim_not_found")
        if not claim.yandex_claim_id:
            raise ValueError("yandex_claim_missing")
        try:
            result = await self._yandex.terminate_claim(claim.yandex_claim_id)
        except YandexDeliveryError as exc:
            raise ValueError(str(exc)) from exc
        await self._delivery_repo.update_claim_status(claim, status=DeliveryClaimStatus.CANCELLED.value)
        await self._session.commit()
        return result
