from __future__ import annotations

import logging
import re
from uuid import UUID

from app.infrastructure.messaging.telegram_notifier import TelegramNotifier
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository

logger = logging.getLogger(__name__)

PHONE_PATTERN = re.compile(r"^\+998\d{9}$")


class MarketplaceUseCases:
    def __init__(self, repo: MarketplaceRepository, notifier: TelegramNotifier) -> None:
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
        ref_token: str | None,
    ) -> dict:
        if not PHONE_PATTERN.match(customer_phone):
            raise ValueError("Phone must match +998XXXXXXXXX format")
        lead = await self._repo.create_lead(
            product_id=product_id,
            shop_id=shop_id,
            customer_phone=customer_phone,
            customer_name=customer_name,
            ref_token=ref_token,
        )
        shop = await self._repo.get_shop(shop_id)
        if shop and shop.telegram_chat_id:
            await self._notifier.notify_shop_lead(
                int(shop.telegram_chat_id),
                f"Yangi so'rov: {customer_name or 'Noma`lum'} | {customer_phone} | lead_id={lead.id}",
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
        if event_type not in {"view", "lead", "visit", "share"}:
            raise ValueError("event_type must be one of: view, lead, visit, share")
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
