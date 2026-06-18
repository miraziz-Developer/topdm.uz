from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import (
    LeadModel,
    MerchantAlertLogModel,
    MerchantPendingProductModel,
    ProductModel,
    RouteStatModel,
    ShopModel,
)


class RouteStatsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def record_route(
        self,
        *,
        market_slug: str,
        level: int,
        start_node_id: str,
        goal_node_id: str,
        node_ids: list[str],
        source: str = "api",
    ) -> RouteStatModel:
        row = RouteStatModel(
            market_slug=market_slug.lower().strip(),
            level=level,
            start_node_id=start_node_id,
            goal_node_id=goal_node_id,
            node_ids=node_ids,
            source=source,
        )
        self.session.add(row)
        await self.session.flush()
        return row

    async def node_heatmap(
        self,
        market_slug: str,
        *,
        level: int = 1,
        days: int = 30,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """Aggregate hit counts per graph node_id from stored route paths."""
        since = datetime.now(timezone.utc) - timedelta(days=days)
        result = await self.session.execute(
            select(RouteStatModel.node_ids, RouteStatModel.goal_node_id).where(
                RouteStatModel.market_slug == market_slug.lower().strip(),
                RouteStatModel.level == level,
                RouteStatModel.created_at >= since,
            )
        )
        counts: dict[str, int] = {}
        for node_ids, goal in result.all():
            path_nodes = node_ids if isinstance(node_ids, list) else []
            for nid in path_nodes:
                key = str(nid)
                counts[key] = counts.get(key, 0) + 1
            if goal:
                g = str(goal)
                counts[g] = counts.get(g, 0) + 2

        ranked = sorted(counts.items(), key=lambda item: item[1], reverse=True)[:limit]
        if not ranked:
            return []
        max_hits = ranked[0][1] or 1
        return [
            {
                "node_id": node_id,
                "hits": hits,
                "intensity": round(hits / max_hits, 4),
            }
            for node_id, hits in ranked
        ]

    async def stall_heatmap(
        self,
        market_slug: str,
        *,
        level: int = 1,
        days: int = 30,
    ) -> list[dict[str, Any]]:
        """Map goal_node_id hits to indoor_stalls.graph_node_id for CRM glow."""
        node_rows = await self.node_heatmap(market_slug, level=level, days=days, limit=200)
        intensity_by_node = {row["node_id"]: row["intensity"] for row in node_rows}
        from app.infrastructure.repositories.indoor_map_repo import IndoorMapRepository

        indoor = IndoorMapRepository(self.session)
        market = await indoor.get_market_by_slug(market_slug)
        if not market:
            return []
        plan = await indoor.get_floor_plan(market.id, level)
        if not plan:
            return []
        stalls = await indoor.list_stalls(plan.id)
        out: list[dict[str, Any]] = []
        for stall in stalls:
            intensity = intensity_by_node.get(stall.graph_node_id, 0.0)
            if intensity <= 0:
                continue
            out.append(
                {
                    "stall_id": str(stall.id),
                    "graph_node_id": stall.graph_node_id,
                    "block_code": stall.block_code,
                    "stall_code": stall.stall_code,
                    "intensity": intensity,
                }
            )
        out.sort(key=lambda item: item["intensity"], reverse=True)
        return out

    async def count_routes(self, market_slug: str, *, level: int = 1, days: int = 30) -> int:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        result = await self.session.execute(
            select(func.count(RouteStatModel.id)).where(
                RouteStatModel.market_slug == market_slug.lower().strip(),
                RouteStatModel.level == level,
                RouteStatModel.created_at >= since,
            )
        )
        return int(result.scalar() or 0)


class MerchantAlertsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def was_alert_sent_recently(self, shop_id: UUID, alert_type: str, *, hours: int = 24) -> bool:
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        result = await self.session.execute(
            select(func.count(MerchantAlertLogModel.id)).where(
                MerchantAlertLogModel.shop_id == shop_id,
                MerchantAlertLogModel.alert_type == alert_type,
                MerchantAlertLogModel.sent_at >= since,
            )
        )
        return int(result.scalar() or 0) > 0

    async def log_alert(self, shop_id: UUID, alert_type: str) -> None:
        self.session.add(MerchantAlertLogModel(shop_id=shop_id, alert_type=alert_type))
        await self.session.flush()

    async def shops_needing_upload_nudge(self, idle_days: int) -> list[ShopModel]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=idle_days)
        shops_result = await self.session.execute(
            select(ShopModel).where(ShopModel.is_active == True, ShopModel.telegram_chat_id.is_not(None))
        )
        needy: list[ShopModel] = []
        for shop in shops_result.scalars().all():
            last_upload = await self.session.execute(
                select(func.max(MerchantPendingProductModel.created_at)).where(
                    MerchantPendingProductModel.shop_id == shop.id
                )
            )
            last_at = last_upload.scalar()
            if last_at is None or last_at < cutoff:
                needy.append(shop)
        return needy

    async def shops_with_stale_leads(self, stale_hours: int) -> list[tuple[ShopModel, int]]:
        _ = stale_hours
        pending = (
            select(LeadModel.shop_id, func.count(LeadModel.id).label("pending_count"))
            .where(LeadModel.status == "pending")
            .group_by(LeadModel.shop_id)
            .having(func.count(LeadModel.id) > 0)
            .subquery()
        )
        result = await self.session.execute(
            select(ShopModel, pending.c.pending_count)
            .join(pending, ShopModel.id == pending.c.shop_id)
            .where(ShopModel.is_active == True, ShopModel.telegram_chat_id.is_not(None))
        )
        return [(shop, int(count)) for shop, count in result.all()]

    async def shops_with_low_stock(self, *, threshold: int = 3) -> list[tuple[ShopModel, list[tuple[str, int]]]]:
        result = await self.session.execute(
            select(ShopModel)
            .where(ShopModel.is_active == True, ShopModel.telegram_chat_id.is_not(None))
        )
        out: list[tuple[ShopModel, list[tuple[str, int]]]] = []
        for shop in result.scalars().all():
            prods = await self.session.execute(
                select(ProductModel.name, ProductModel.stock_count).where(
                    ProductModel.shop_id == shop.id,
                    ProductModel.is_available == True,
                    ProductModel.stock_count <= threshold,
                ).limit(8)
            )
            rows = [(str(name), int(stock or 0)) for name, stock in prods.all()]
            if rows:
                out.append((shop, rows))
        return out
