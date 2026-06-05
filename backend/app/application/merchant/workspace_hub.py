from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.merchant.chat_service import MerchantChatService
from app.application.merchant.shop_trust_service import ShopTrustService
from app.core.config import get_settings
from app.infrastructure.cache.redis_gateway import RedisCacheGateway
from app.infrastructure.db.models import LeadModel, OrderModel, ProductModel, ShopModel
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.infrastructure.repositories.route_stats_repo import RouteStatsRepository


def _normalize_phone(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) == 9:
        return f"+998{digits}"
    if len(digits) == 12 and digits.startswith("998"):
        return f"+{digits}"
    return phone.strip()


class MerchantWorkspaceHub:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = MarketplaceRepository(session)
        self._settings = get_settings()
        self._cache = RedisCacheGateway()

    async def build_today_panel(self, shop_id: UUID) -> dict[str, Any]:
        shop = await self._repo.get_shop(shop_id)
        if not shop:
            raise ValueError("shop_not_found")

        now = datetime.now(timezone.utc)
        orders = await self._repo.list_shop_orders(shop_id, limit=50)
        pending_orders = [o for o in orders if (o.status or "").lower() in {"pending", "new", "confirmed"}]

        leads = await self._repo.list_shop_leads(shop_id, limit=50)
        stale_leads = [l for l in leads if (l.status or "pending").lower() == "pending"]
        open_leads = [l for l in leads if (l.status or "").lower() in {"pending", "open", "new"}]

        chat = MerchantChatService(self._session)
        threads = await chat.list_shop_threads(shop_id, limit=40)
        chats_waiting = [t for t in threads if (t.last_sender_role or "") == "customer"]

        products = await self._repo.list_shop_products(shop_id, limit=5, offset=0)
        last_upload_hint = len(products) < 3

        alerts = await self._load_recent_alerts(shop_id, limit=8)

        tasks: list[dict[str, Any]] = []
        for o in pending_orders[:5]:
            tasks.append(
                {
                    "type": "order",
                    "priority": "high",
                    "id": str(o.id),
                    "title": f"Buyurtma: {(o.product.name if o.product else 'mahsulot')}",
                    "subtitle": f"{o.status} · {o.total_price:,} so'm".replace(",", " "),
                    "href": "/dashboard/sales?tab=orders",
                }
            )
        for t in chats_waiting[:5]:
            tasks.append(
                {
                    "type": "chat",
                    "priority": "high",
                    "id": str(t.id),
                    "title": t.customer_display_name or t.customer_key,
                    "subtitle": (t.last_message or "Yangi xabar")[:80],
                    "href": "/dashboard/chat",
                }
            )
        for l in stale_leads[:3]:
            tasks.append(
                {
                    "type": "lead",
                    "priority": "medium",
                    "id": str(l.id),
                    "title": f"Lead: {l.customer_phone}",
                    "subtitle": "Javob kutilmoqda",
                    "href": "/dashboard/sales?tab=leads",
                }
            )
        if not shop.is_verified:
            tasks.append(
                {
                    "type": "system",
                    "priority": "medium",
                    "id": "verify",
                    "title": "Saytda chiqish kutilmoqda",
                    "subtitle": "Platforma tasdiqlagach mijozlar ko'radi",
                    "href": "/dashboard",
                }
            )
        if last_upload_hint:
            tasks.append(
                {
                    "type": "catalog",
                    "priority": "low",
                    "id": "upload",
                    "title": "Yangi mahsulot qo'shing",
                    "subtitle": "Telegram botga rasm yuboring",
                    "href": "/dashboard/products?tab=catalog",
                }
            )

        return {
            "generated_at": now.isoformat(),
            "shop_verified": bool(shop.is_verified),
            "counts": {
                "pending_orders": len(pending_orders),
                "chats_waiting": len(chats_waiting),
                "open_leads": len(open_leads),
                "stale_leads": len(stale_leads),
                "route_alerts": len(alerts),
            },
            "tasks": tasks[:12],
            "alerts": alerts,
        }

    async def customer_history(self, shop_id: UUID, phone: str) -> dict[str, Any]:
        normalized = _normalize_phone(phone)
        suffix = normalized[-9:] if len(normalized) >= 9 else normalized

        lead_rows = await self._session.execute(
            select(LeadModel)
            .where(
                LeadModel.shop_id == shop_id,
                LeadModel.customer_phone.ilike(f"%{suffix}%"),
            )
            .order_by(LeadModel.id.desc())
            .limit(20)
        )
        order_rows = await self._session.execute(
            select(OrderModel)
            .where(
                OrderModel.shop_id == shop_id,
                OrderModel.customer_phone.ilike(f"%{suffix}%"),
            )
            .order_by(OrderModel.created_at.desc())
            .limit(20)
        )
        leads = list(lead_rows.scalars().all())
        orders = list(order_rows.scalars().all())
        is_returning = len(leads) + len(orders) > 1

        return {
            "phone": normalized,
            "is_returning_customer": is_returning,
            "total_leads": len(leads),
            "total_orders": len(orders),
            "leads": [
                {
                    "id": str(l.id),
                    "status": l.status,
                    "customer_name": l.customer_name,
                }
                for l in leads
            ],
            "orders": [
                {
                    "id": str(o.id),
                    "status": o.status,
                    "total_price": o.total_price,
                    "quantity": o.quantity,
                    "created_at": o.created_at.isoformat() if o.created_at else None,
                }
                for o in orders
            ],
        }

    async def analytics_summary(self, shop_id: UUID, *, days: int = 7) -> dict[str, Any]:
        days = max(1, min(days, 365))
        shop = await self._repo.get_shop(shop_id)
        if not shop:
            raise ValueError("shop_not_found")

        stats = await self._repo.get_shop_dashboard_stats(shop_id)
        products = await self._repo.list_shop_products(shop_id, limit=200, offset=0)
        top_views = sorted(products, key=lambda p: int(p.view_count or 0), reverse=True)[:5]

        slug = (shop.market_zone or "ippodrom").lower()
        route_repo = RouteStatsRepository(self._session)
        routes_to_shop = 0
        try:
            stalls = await route_repo.stall_heatmap(slug, level=1, days=days)
            stall_ids = {str(s.get("stall_id")) for s in stalls if s.get("stall_id")}
            if shop.indoor_stall_id and str(shop.indoor_stall_id) in stall_ids:
                routes_to_shop = sum(int(s.get("hits") or 0) for s in stalls if str(s.get("stall_id")) == str(shop.indoor_stall_id))
        except Exception:
            routes_to_shop = 0

        since = datetime.now(timezone.utc) - timedelta(days=days)
        orders_period = await self._repo.count_shop_orders_since(shop_id, since=since)

        block = (shop.block_sector or "A")[:1].upper()
        stall_no = shop.stall_number or "12"
        stall_goal = f"stall-{block}-{stall_no}"
        series_payload = await self._repo.shop_analytics_time_series(
            shop_id,
            days=days,
            market_slug=slug,
            stall_goal_node_id=stall_goal,
        )

        return {
            "days": days,
            "granularity": series_payload["granularity"],
            "period_label": series_payload["period_label"],
            "daily_series": series_payload["series"],
            "totals": {
                "products": stats.total_products,
                "leads": stats.total_leads,
                "views": stats.total_views,
                "visits": stats.total_visits,
                "orders_period": orders_period,
                "map_routes_period": routes_to_shop,
            },
            "top_products": [
                {
                    "id": str(p.id),
                    "name": p.name,
                    "price": p.price,
                    "view_count": int(p.view_count or 0),
                    "lead_count": int(p.lead_count or 0),
                }
                for p in top_views
            ],
            "conversion_hint": (
                f"{stats.total_views} ko'rish → {stats.total_leads} lead → {orders_period} buyurtma "
                f"({series_payload['period_label']})"
            ),
        }

    async def share_kit(self, shop: ShopModel) -> dict[str, Any]:
        from app.application.merchant.share_kit import build_share_kit

        hours_payload = await self.get_operating_hours(shop.id)
        return build_share_kit(
            shop,
            settings=self._settings,
            operating_hours=hours_payload.get("operating_hours"),
        )

    async def bulk_discount(
        self,
        shop_id: UUID,
        *,
        percent_off: int,
        product_ids: list[UUID] | None = None,
    ) -> dict[str, Any]:
        if not 1 <= percent_off <= 90:
            raise ValueError("percent_off_1_90")
        factor = (100 - percent_off) / 100.0

        stmt = select(ProductModel).where(ProductModel.shop_id == shop_id, ProductModel.is_available == True)
        if product_ids:
            stmt = stmt.where(ProductModel.id.in_(product_ids))
        result = await self._session.execute(stmt)
        rows = list(result.scalars().all())
        if not rows:
            return {"updated": 0, "percent_off": percent_off}

        updated = 0
        for row in rows:
            new_price = max(1000, int(round(row.price * factor)))
            row.price = new_price
            updated += 1
        await self._session.commit()
        return {"updated": updated, "percent_off": percent_off}

    async def restock_notify_leads(
        self,
        shop_id: UUID,
        *,
        product_id: UUID,
        message: str | None = None,
    ) -> dict[str, Any]:
        product = await self._repo.get_product_by_id(product_id)
        if not product or product.shop_id != shop_id:
            raise ValueError("product_not_found")

        leads = await self._repo.list_shop_leads(shop_id, limit=100)
        targets = [l for l in leads if (l.status or "").lower() in {"pending", "open", "contacted", "new"}]
        text = message or f"'{product.name}' keldi / mavjud. Narxi {product.price:,} so'm.".replace(",", " ")

        shop = await self._repo.get_shop(shop_id)
        notified_phones: list[str] = []
        if shop and shop.telegram_chat_id and self._settings.telegram_bot_token:
            notifier = TelegramNotifierGateway(self._settings.telegram_bot_token)
            phones = ", ".join({l.customer_phone for l in targets[:8]})
            from app.application.merchant.telegram_crm_notify import notify_merchant_telegram

            await notify_merchant_telegram(
                notifier,
                chat_id=int(shop.telegram_chat_id),
                text=(
                    f"Qayta stok xabari tayyor ({product.name}).\n"
                    f"Mijozlarga qo'ng'iroq qiling:\n{phones or '—'}\n\nMatn: {text}"
                ),
                shop_id=shop_id,
                crm_next="/dashboard/sales",
            )

        await self.push_alert(
            shop_id,
            {
                "type": "restock_campaign",
                "title": f"Stok: {product.name}",
                "body": f"{len(targets)} ta lead uchun matn tayyor",
            },
        )
        return {
            "product_id": str(product_id),
            "lead_count": len(targets),
            "sample_phones": [l.customer_phone for l in targets[:10]],
            "message_template": text,
        }

    async def push_alert(self, shop_id: UUID, payload: dict[str, Any]) -> None:
        key = f"merchant:alerts:{shop_id}"
        existing = await self._cache.get(key) or []
        if not isinstance(existing, list):
            existing = []
        entry = {**payload, "at": datetime.now(timezone.utc).isoformat()}
        merged = [entry, *existing][:30]
        await self._cache.set(key, merged, ttl_seconds=60 * 60 * 24 * 7)

    async def _load_recent_alerts(self, shop_id: UUID, *, limit: int = 10) -> list[dict[str, Any]]:
        raw = await self._cache.get(f"merchant:alerts:{shop_id}") or []
        if not isinstance(raw, list):
            return []
        return raw[:limit]

    async def get_operating_hours(self, shop_id: UUID) -> dict[str, Any]:
        from app.application.merchant.workspace_draft import load_workspace_draft

        data = await load_workspace_draft(shop_id)
        hours = data.get("operating_hours") or {
            "open": "09:00",
            "close": "20:00",
            "busy_note": "",
        }
        return {"operating_hours": hours}

    async def set_operating_hours(self, shop_id: UUID, hours: dict[str, Any]) -> dict[str, Any]:
        from app.application.merchant.workspace_draft import merge_workspace_draft

        merged = await merge_workspace_draft(shop_id, {"operating_hours": hours})
        return {"operating_hours": merged.get("operating_hours") or hours}
