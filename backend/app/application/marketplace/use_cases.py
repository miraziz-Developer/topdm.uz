from __future__ import annotations

import logging
import re
from uuid import UUID

from app.core.phone import normalize_uz_phone_e164
from app.application.marketplace.order_tracking import enrich_order_for_live_tracker
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.interfaces.api.serializers import _ipadrom_name

logger = logging.getLogger(__name__)

PHONE_PATTERN = re.compile(r"^\+998\d{9}$")
PICKUP_TIME_LABELS = {
    "09:00": "09:00 - 11:00 (Ertalab)",
    "12:00": "11:00 - 14:00 (Tushlik)",
    "15:00": "14:00 - 17:00 (Abaddan keyin)",
}


class MarketplaceUseCases:
    def __init__(self, repo: MarketplaceRepository, notifier: NotifierGateway) -> None:
        self._repo = repo
        self._notifier = notifier

    async def create_product(
        self,
        *,
        shop_id: UUID,
        category_id: UUID | None,
        name: str,
        description: str | None,
        price: int,
        images: list[str],
        attributes: dict,
        embedding: list[float],
    ) -> dict:
        if not (0 < price < 100_000_000):
            raise ValueError("Price must be between 1 and 100_000_000 UZS")
        if len(embedding) != 1536:
            raise ValueError("Embedding must be 1536 dimensions")

        product = await self._repo.create_product(
            shop_id=shop_id,
            category_id=category_id,
            name=name,
            description=description,
            price=price,
            images=images,
            attributes=attributes,
            embedding=embedding,
        )
        return {"product_id": str(product.id), "status": "created"}

    async def create_lead(
        self,
        *,
        product_id: UUID,
        shop_id: UUID,
        customer_phone: str,
        customer_name: str | None,
        note: str | None,
        ref_token: str | None,
    ) -> dict:
        if not PHONE_PATTERN.match(customer_phone):
            raise ValueError("Phone must match +998XXXXXXXXX format")
        lead = await self._repo.create_lead(
            product_id=product_id,
            shop_id=shop_id,
            customer_phone=customer_phone,
            customer_name=customer_name,
            note=note,
            ref_token=ref_token,
        )
        shop = await self._repo.get_shop(shop_id)
        if shop:
            from app.application.merchant.merchant_order_notify import notify_merchant_new_lead

            note_text = (note or "").strip() or (customer_name or "Mijoz")
            await notify_merchant_new_lead(
                self._notifier,
                shop=shop,
                customer_phone=customer_phone,
                message=note_text,
                source="sayt",
            )
        return {"lead_id": str(lead.id), "status": "pending"}

    async def track_event(
        self,
        *,
        event_type: str,
        product_id: UUID | None,
        shop_id: UUID | None,
        ref_token: str | None,
        session_id: str | None,
        metadata: dict,
    ) -> dict:
        if event_type not in {"view", "lead", "visit", "share", "search"}:
            raise ValueError("event_type must be one of: view, lead, visit, share, search")
        event = await self._repo.create_tracking_event(
            event_type=event_type,
            product_id=product_id,
            shop_id=shop_id,
            ref_token=ref_token,
            session_id=session_id,
            metadata=metadata,
        )
        return {"event_id": str(event.id), "status": "tracked"}

    async def get_shop_dashboard(self, shop_id: UUID) -> dict:
        stats = await self._repo.get_shop_dashboard_stats(shop_id)
        leads = await self._repo.list_shop_leads(shop_id, limit=20)
        logger.info("shop_dashboard_loaded", extra={"shop_id": str(shop_id), "leads_count": len(leads)})
        return {
            "stats": {
                "total_products": stats.total_products,
                "total_leads": stats.total_leads,
                "total_views": stats.total_views,
                "total_visits": stats.total_visits,
            },
            "leads": [
                {
                    "id": str(lead.id),
                    "customer_phone": lead.customer_phone,
                    "customer_name": lead.customer_name,
                    "status": lead.status,
                    "ref_token": lead.ref_token,
                }
                for lead in leads
            ],
        }

    async def create_order(
        self,
        *,
        customer_phone: str,
        product_id: UUID,
        quantity: int,
        note: str | None,
        ref_token: str | None,
    ) -> dict:
        if not PHONE_PATTERN.match(customer_phone):
            raise ValueError("Phone must match +998XXXXXXXXX format")
        if quantity < 1 or quantity > 99:
            raise ValueError("Quantity must be between 1 and 99")

        product = await self._repo.get_product_by_id(product_id)
        if not product or not product.is_available:
            raise ValueError("Product not found or unavailable")

        from app.application.pricing.product_markup import order_line_totals

        _merchant_sub, total_price, _markup = order_line_totals(int(product.price), quantity)
        order = await self._repo.create_order(
            customer_phone=customer_phone,
            product_id=product_id,
            shop_id=product.shop_id,
            quantity=quantity,
            total_price=total_price,
            note=note,
            ref_token=ref_token,
        )
        return {
            "order_id": str(order.id),
            "status": order.status,
            "total_price": float(order.total_price),
        }

    async def list_customer_orders(
        self,
        *,
        user_id: UUID | None = None,
        customer_phone: str | None = None,
        customer_email: str | None = None,
        scope: str = "all",
        limit: int = 50,
    ) -> list[dict]:
        phone = normalize_uz_phone_e164(customer_phone) if customer_phone else None
        orders = await self._repo.list_orders_for_account(
            user_id=user_id,
            phone=phone,
            email=customer_email,
            scope=scope,
            limit=limit,
        )
        return [self._order_to_dict(order) for order in orders]

    async def get_live_orders(
        self,
        *,
        user_id: UUID | None = None,
        customer_phone: str | None = None,
        customer_email: str | None = None,
        scope: str = "all",
    ) -> list[dict]:
        """Profile / lookup buyurtmalar — tracker maydonlari bilan."""
        orders = await self.list_customer_orders(
            user_id=user_id,
            customer_phone=customer_phone,
            customer_email=customer_email,
            scope=scope,
        )
        return [enrich_order_for_live_tracker(order) for order in orders]

    async def get_customer_order(
        self,
        *,
        user_id: UUID | None,
        customer_phone: str | None,
        customer_email: str | None,
        order_id: UUID,
    ) -> dict:
        phone = normalize_uz_phone_e164(customer_phone) if customer_phone else None
        order = await self._repo.get_order_for_account(
            order_id,
            user_id=user_id,
            phone=phone,
            email=customer_email,
        )
        if not order:
            raise ValueError("Order not found")
        return self._order_to_dict(order)

    async def set_product_featured(self, *, shop_id: UUID, product_id: UUID, featured: bool) -> dict:
        product = await self._repo.set_product_featured(shop_id=shop_id, product_id=product_id, featured=featured)
        if not product:
            raise ValueError("Product not found for this shop")
        return {"product_id": str(product.id), "is_featured": product.is_featured}

    async def update_lead_status(self, *, shop_id: UUID, lead_id: UUID, status: str, note: str | None) -> dict:
        allowed = {"pending", "contacted", "visited", "done", "cancelled"}
        if status not in allowed:
            raise ValueError(f"status must be one of: {', '.join(sorted(allowed))}")
        lead = await self._repo.update_lead_status(shop_id=shop_id, lead_id=lead_id, status=status, note=note)
        if not lead:
            raise ValueError("Lead not found")
        return {"lead_id": str(lead.id), "status": lead.status}

    async def update_order_status(self, *, shop_id: UUID, order_id: UUID, status: str) -> dict:
        from sqlalchemy import select

        from app.infrastructure.db.models import OrderModel
        from app.services.inventory import ACTIVE_RESERVED_STATUSES, release_order_reserved_stock

        allowed = {"pending", "reserved", "confirmed", "preparing", "ready", "completed", "cancelled"}
        if status not in allowed:
            raise ValueError(f"status must be one of: {', '.join(sorted(allowed))}")

        existing = (
            await self._repo._session.execute(
                select(OrderModel).where(OrderModel.id == order_id, OrderModel.shop_id == shop_id)
            )
        ).scalar_one_or_none()
        if not existing:
            raise ValueError("Order not found")
        prev_status = existing.status

        if status == "cancelled" and prev_status in ACTIVE_RESERVED_STATUSES:
            try:
                await release_order_reserved_stock(self._repo._session, order_id=order_id)
            except Exception:
                logger.exception("order_stock_release_failed", extra={"order_id": str(order_id)})

        order = await self._repo.update_order_status(shop_id=shop_id, order_id=order_id, status=status)
        if not order:
            raise ValueError("Order not found")

        if status == "completed" and prev_status != "completed":
            from app.application.finance.transaction_splitter import TransactionSplitterService
            from app.application.merchant.growth_service import MerchantGrowthService

            splitter = TransactionSplitterService(self._repo._session)
            try:
                await splitter.release_escrow_to_merchant(order_id)
            except Exception:
                logger.exception("escrow_release_failed", extra={"order_id": str(order_id)})
            from app.application.billing.merchant_debt_service import MerchantDebtService

            try:
                await MerchantDebtService(self._repo._session).process_cash_pickup_completion(order_id)
            except Exception:
                logger.exception("cash_completion_debt_failed", extra={"order_id": str(order_id)})
            try:
                await MerchantGrowthService(self._repo._session).try_reward_referral(shop_id)
            except Exception:
                logger.debug("referral_reward_skipped", exc_info=True)

        return {"order_id": str(order.id), "status": order.status}

    @staticmethod
    def _order_to_dict(order) -> dict:
        product = order.product
        shop = order.shop
        return {
            "id": str(order.id),
            "status": order.status,
            "quantity": order.quantity,
            "total_price": float(order.total_price),
            "note": order.note,
            "ref_token": order.ref_token,
            "fulfillment_type": getattr(order, "fulfillment_type", "delivery"),
            "pickup_date": order.pickup_date.isoformat() if getattr(order, "pickup_date", None) else None,
            "pickup_time": getattr(order, "pickup_time", None),
            "pickup_window_label": PICKUP_TIME_LABELS.get(getattr(order, "pickup_time", None) or ""),
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "updated_at": order.updated_at.isoformat() if order.updated_at else None,
            "product": {
                "id": str(product.id) if product else "",
                "name": product.name if product else "",
                "price": float(product.price) if product else 0,
                "images": product.images if product else [],
            },
            "shop": {
                "id": str(shop.id) if shop else "",
                "name": shop.name if shop else "",
                "slug": shop.slug if shop else "",
                "ipadrom": _ipadrom_name(shop) if shop else "",
                "floor": shop.floor if shop else "",
                "section": shop.section if shop else "",
                "block_sector": getattr(shop, "block_sector", None) if shop else None,
            },
        }
