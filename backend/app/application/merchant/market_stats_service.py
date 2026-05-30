from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.indoor_navigation.route_analytics import record_calculated_route
from app.infrastructure.repositories.route_stats_repo import RouteStatsRepository


@dataclass(slots=True)
class HeatmapPayload:
    market_slug: str
    level: int
    days: int
    nodes: list[dict[str, Any]]
    stalls: list[dict[str, Any]]
    total_routes: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "market_slug": self.market_slug,
            "level": self.level,
            "days": self.days,
            "nodes": self.nodes,
            "stalls": self.stalls,
            "total_routes": self.total_routes,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }


class MarketStatsService:
    """Live navigation analytics for CRM heatmap visualization."""

    def __init__(self, session: AsyncSession) -> None:
        self._repo = RouteStatsRepository(session)
        self._session = session

    async def record_route(
        self,
        *,
        market_slug: str,
        level: int,
        start_node_id: str,
        goal_node_id: str,
        node_ids: list[str],
        source: str,
        commit: bool = True,
    ) -> None:
        await record_calculated_route(
            self._session,
            market_slug=market_slug,
            level=level,
            start_node_id=start_node_id,
            goal_node_id=goal_node_id,
            node_ids=node_ids,
            source=source,
        )
        if commit:
            await self._session.commit()

    async def heatmap(self, market_slug: str, *, level: int = 1, days: int = 30) -> HeatmapPayload:
        slug = market_slug.lower().strip()
        nodes = await self._repo.node_heatmap(slug, level=level, days=days)
        stalls = await self._repo.stall_heatmap(slug, level=level, days=days)
        total = await self._repo.count_routes(slug, level=level, days=days)
        return HeatmapPayload(
            market_slug=slug,
            level=level,
            days=days,
            nodes=nodes,
            stalls=stalls,
            total_routes=total,
        )
