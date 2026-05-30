"""Auto indoor route to first recommended shop (P2: look → map)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.indoor_navigation.market_map_loader import load_market_map
from app.application.indoor_navigation.pathfinding import build_route
from app.infrastructure.repositories.indoor_map_repo import IndoorMapRepository
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository


async def build_stylist_mini_map_block(
    db: AsyncSession,
    catalog: list[dict[str, Any]],
    product_ids: list[str],
    *,
    start_node_id: str = "entrance-A",
    market_slug: str = "ippodrom",
    level: int = 1,
) -> dict[str, Any] | None:
    """
    Build mini_map block when products map to a stall with graph_node_id.
    Uses first pick's shop as navigation goal.
    """
    if not product_ids or not catalog:
        return None

    by_id = {str(p.get("id")): p for p in catalog if p.get("id")}
    goal_node: str | None = None
    resolved_slug = market_slug
    resolved_level = level

    marketplace = MarketplaceRepository(db)
    indoor = IndoorMapRepository(db)

    for pid in product_ids:
        product = by_id.get(str(pid))
        if not product:
            continue
        shop_info = product.get("shop") if isinstance(product.get("shop"), dict) else {}
        shop_id_raw = str(shop_info.get("id") or "").strip()
        if not shop_id_raw:
            continue
        try:
            shop = await marketplace.get_shop(UUID(shop_id_raw))
        except (TypeError, ValueError):
            continue
        if not shop:
            continue
        if shop.indoor_stall_id:
            stall = await indoor.get_stall(shop.indoor_stall_id)
            if stall and stall.graph_node_id:
                goal_node = str(stall.graph_node_id).strip()
                if shop.ipadrom_id:
                    resolved_slug = "ippodrom"
                break

    if not goal_node:
        return None

    start = (start_node_id or "entrance-A").strip() or "entrance-A"
    try:
        payload = await load_market_map(resolved_slug, db)
        level_payload = next((lv for lv in payload.get("levels") or [] if lv.get("level") == resolved_level), None)
        if not level_payload:
            level_payload = (payload.get("levels") or [None])[0]
        if not level_payload:
            return None
        graph = level_payload.get("navigation_graph") or {}
        route = build_route(graph, start, goal_node)
        if not route.get("node_ids"):
            return None

        from app.application.indoor_navigation.route_analytics import record_calculated_route

        await record_calculated_route(
            db,
            market_slug=resolved_slug,
            level=int(level_payload.get("level") or resolved_level),
            start_node_id=start,
            goal_node_id=goal_node,
            node_ids=[str(n) for n in route["node_ids"]],
            source="stylist_chat",
        )

        return {
            "type": "mini_map",
            "market_slug": resolved_slug,
            "level": int(level_payload.get("level") or resolved_level),
            "start_node_id": start,
            "goal_node_id": goal_node,
            "route": {
                "node_ids": route.get("node_ids") or [],
                "points": route.get("points") or [],
                "distance": float(route.get("distance") or 0),
            },
        }
    except Exception as exc:
        logger.warning("stylist_mini_map_failed: {}", exc)
        return None
