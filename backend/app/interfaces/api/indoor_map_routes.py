from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.indoor_navigation.geofence import geofence_status, gps_to_local_point
from app.application.indoor_navigation.market_map_loader import load_market_map
from app.application.indoor_navigation.pathfinding import build_route
from app.application.indoor_navigation.route_from_coordinates import resolve_route_from_coordinates
from app.application.indoor_navigation.fixtures import get_market_geofence
from app.application.indoor_navigation.route_analytics import record_calculated_route
from app.application.merchant.customer_approach import CustomerApproachService
from app.application.merchant.customer_route_notify import schedule_route_customer_notifications
from app.infrastructure.db.session import get_db_session

router = APIRouter(prefix="/indoor-maps", tags=["indoor-maps"])


class GeofenceCheckRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class RouteFromCoordinatesRequest(BaseModel):
    goal_node_id: str = Field(..., min_length=1, max_length=64)
    start_node_id: str | None = Field(default=None, max_length=64)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    local_x: float | None = None
    local_y: float | None = None
    order_id: str | None = Field(default=None, max_length=64)
    customer_phone: str | None = Field(default=None, max_length=20)


@router.get("/{market_slug}/geofence")
async def get_market_geofence_boundary(market_slug: str) -> dict:
    geofence = get_market_geofence(market_slug)
    return {
        "market_slug": market_slug.lower().strip(),
        "geofence": geofence,
    }


@router.post("/{market_slug}/geofence/check")
async def check_market_geofence(market_slug: str, payload: GeofenceCheckRequest) -> dict:
    geofence = get_market_geofence(market_slug)
    status = geofence_status(payload.lat, payload.lng, geofence)
    pin = gps_to_local_point(payload.lat, payload.lng, geofence)
    return {
        **status,
        "pin": pin,
        "message": None
        if status["inside"]
        else "Siz bozor hududida emassiz, iltimos do'koningizda turib joylashuvni aniqlang.",
    }


@router.get("/{market_slug}")
async def get_market_map(market_slug: str, db: AsyncSession = Depends(get_db_session)) -> dict:
    return await load_market_map(market_slug, db)


@router.get("/{market_slug}/levels/{level}/route")
async def get_market_route(
    market_slug: str,
    level: int,
    start_node_id: str,
    goal_node_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    payload = await load_market_map(market_slug, db)
    level_payload = next((item for item in payload["levels"] if item["level"] == level), None)
    if not level_payload:
        raise HTTPException(status_code=404, detail="Floor plan not found")

    graph = level_payload["navigation_graph"]
    route = build_route(graph, start_node_id, goal_node_id)
    if not route["node_ids"]:
        reason = route.get("error") or "route_not_found"
        raise HTTPException(status_code=404, detail={"code": reason, "message": "Route not found"})
    await record_calculated_route(
        db,
        market_slug=market_slug,
        level=level,
        start_node_id=start_node_id,
        goal_node_id=goal_node_id,
        node_ids=[str(n) for n in route["node_ids"]],
        source="api",
    )
    await db.commit()

    schedule_route_customer_notifications(
        background_tasks,
        [
            {
                "market_slug": market_slug,
                "level": level,
                "goal_node_id": goal_node_id,
                "distance_units": float(route.get("distance") or 0),
            }
        ],
    )
    return route


@router.post("/{market_slug}/levels/{level}/route/from-coordinates")
async def post_route_from_coordinates(
    market_slug: str,
    level: int,
    payload: RouteFromCoordinatesRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Snap Ippodrom GPS/local coordinates to the navigation graph, then run A*."""
    map_payload = await load_market_map(market_slug, db)
    level_payload = next((item for item in map_payload["levels"] if item["level"] == level), None)
    if not level_payload:
        raise HTTPException(status_code=404, detail="Floor plan not found")

    if not payload.start_node_id and payload.lat is None and payload.local_x is None:
        raise HTTPException(
            status_code=422,
            detail="Provide start_node_id, lat/lng, or local_x/local_y",
        )

    geofence = get_market_geofence(market_slug)
    graph = level_payload["navigation_graph"]
    route = resolve_route_from_coordinates(
        graph=graph,
        geofence=geofence,
        goal_node_id=payload.goal_node_id,
        lat=payload.lat,
        lng=payload.lng,
        local_x=payload.local_x,
        local_y=payload.local_y,
        start_node_id=payload.start_node_id,
    )
    if not route.get("node_ids"):
        reason = route.get("error") or "route_not_found"
        raise HTTPException(status_code=404, detail={"code": reason, "message": "Route not found"})

    await record_calculated_route(
        db,
        market_slug=market_slug,
        level=level,
        start_node_id=str(route.get("start_node_id") or ""),
        goal_node_id=payload.goal_node_id,
        node_ids=[str(n) for n in route["node_ids"]],
        source="coordinates",
    )
    await db.commit()

    schedule_route_customer_notifications(
        background_tasks,
        [
            {
                "market_slug": market_slug,
                "level": level,
                "goal_node_id": payload.goal_node_id,
                "distance_units": float(route.get("distance") or 0),
            }
        ],
    )
    if payload.order_id:
        try:
            oid = UUID(str(payload.order_id).strip())
            service = CustomerApproachService(db)
            await service.record_ping(
                oid,
                customer_phone=payload.customer_phone,
                lat=payload.lat,
                lng=payload.lng,
                local_x=payload.local_x,
                local_y=payload.local_y,
                market_slug=market_slug,
                level=level,
                trusted=True,
            )
        except (ValueError, AttributeError):
            pass
    return route


@router.get("/{market_slug}/heatmap")
async def get_market_route_heatmap(
    market_slug: str,
    level: int = 1,
    days: int = 30,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.application.merchant.market_stats_service import MarketStatsService

    service = MarketStatsService(db)
    payload = await service.heatmap(market_slug, level=level, days=days)
    return payload.to_dict()
