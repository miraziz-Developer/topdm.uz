from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import RouteStatModel, TrackingEventModel
from app.infrastructure.repositories.route_stats_repo import RouteStatsRepository


_BLOCK_RE = re.compile(r"^(?:entrance|corridor|stall)-([A-D])", re.IGNORECASE)


@dataclass(slots=True)
class AdminMarketReport:
    market_slug: str
    days: int
    block_footfall: list[dict[str, Any]]
    top_searches: list[dict[str, Any]]
    total_routes: int
    total_searches: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "market_slug": self.market_slug,
            "days": self.days,
            "block_footfall": self.block_footfall,
            "top_searches": self.top_searches,
            "total_routes": self.total_routes,
            "total_searches": self.total_searches,
        }


class AdminMarketAnalyticsService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._routes = RouteStatsRepository(session)

    async def build_report(self, market_slug: str, *, days: int = 7, level: int = 1) -> AdminMarketReport:
        slug = market_slug.lower().strip()
        since = datetime.now(timezone.utc) - timedelta(days=days)

        node_heatmap = await self._routes.node_heatmap(slug, level=level, days=days)
        block_counts: dict[str, int] = {}
        for row in node_heatmap:
            node_id = str(row.get("node_id") or "")
            match = _BLOCK_RE.match(node_id)
            if not match:
                continue
            block = match.group(1).upper()
            hits = int(row.get("hits") or 0)
            block_counts[block] = block_counts.get(block, 0) + hits

        max_hits = max(block_counts.values()) if block_counts else 1
        block_footfall = [
            {
                "block": block,
                "hits": hits,
                "intensity": round(hits / max_hits, 4),
            }
            for block, hits in sorted(block_counts.items(), key=lambda x: x[1], reverse=True)
        ]

        search_rows = await self._session.execute(
            select(TrackingEventModel.tracking_metadata).where(
                TrackingEventModel.event_type == "search",
                TrackingEventModel.created_at >= since,
            )
        )
        query_counts: dict[str, int] = {}
        for (meta,) in search_rows.all():
            if not isinstance(meta, dict):
                continue
            q = str(meta.get("q") or meta.get("query") or "").strip().lower()
            if not q:
                continue
            query_counts[q] = query_counts.get(q, 0) + 1
        top_searches = [
            {"query": q, "count": c}
            for q, c in sorted(query_counts.items(), key=lambda item: item[1], reverse=True)[:20]
        ]
        total_searches = sum(query_counts.values())

        total_routes = await self._routes.count_routes(slug, days=days)

        return AdminMarketReport(
            market_slug=slug,
            days=days,
            block_footfall=block_footfall,
            top_searches=top_searches,
            total_routes=total_routes,
            total_searches=total_searches,
        )
