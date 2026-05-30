from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.repositories.route_stats_repo import RouteStatsRepository


async def record_calculated_route(
    session: AsyncSession,
    *,
    market_slug: str,
    level: int,
    start_node_id: str,
    goal_node_id: str,
    node_ids: list[str],
    source: str,
) -> None:
    repo = RouteStatsRepository(session)
    await repo.record_route(
        market_slug=market_slug,
        level=level,
        start_node_id=start_node_id,
        goal_node_id=goal_node_id,
        node_ids=node_ids,
        source=source,
    )
