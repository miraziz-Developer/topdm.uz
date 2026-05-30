from __future__ import annotations

from typing import Any

from app.application.indoor_navigation.fixtures import get_market_geofence
from app.application.indoor_navigation.geofence import gps_to_local_point
from app.application.indoor_navigation.graph_snap import nearest_navigation_graph_node
from app.application.indoor_navigation.pathfinding import build_route


def resolve_route_from_coordinates(
    *,
    graph: dict[str, Any],
    geofence: dict[str, Any],
    goal_node_id: str,
    lat: float | None = None,
    lng: float | None = None,
    local_x: float | None = None,
    local_y: float | None = None,
    start_node_id: str | None = None,
) -> dict[str, Any]:
    """Snap GPS or local map coordinates to graph nodes, then run A*."""
    if start_node_id:
        start_id = start_node_id.strip()
    elif lat is not None and lng is not None:
        pin = gps_to_local_point(lat, lng, geofence)
        start_id = nearest_navigation_graph_node(graph, float(pin["x"]), float(pin["y"]))
    elif local_x is not None and local_y is not None:
        start_id = nearest_navigation_graph_node(graph, float(local_x), float(local_y))
    else:
        return {"error": "missing_start", "node_ids": []}

    if not start_id:
        return {"error": "start_snap_failed", "node_ids": []}

    route = build_route(graph, start_id, goal_node_id.strip())
    route["start_node_id"] = start_id
    route["goal_node_id"] = goal_node_id.strip()
    if lat is not None and lng is not None:
        route["origin"] = {"lat": lat, "lng": lng}
    if local_x is not None and local_y is not None:
        route["origin_local"] = {"x": local_x, "y": local_y}
    return route


def build_ippodrom_coordinate_route(
    *,
    goal_node_id: str,
    lat: float | None = None,
    lng: float | None = None,
    local_x: float | None = None,
    local_y: float | None = None,
    start_node_id: str | None = None,
    graph: dict[str, Any],
) -> dict[str, Any]:
    geofence = get_market_geofence("ippodrom")
    return resolve_route_from_coordinates(
        graph=graph,
        geofence=geofence,
        goal_node_id=goal_node_id,
        lat=lat,
        lng=lng,
        local_x=local_x,
        local_y=local_y,
        start_node_id=start_node_id,
    )
