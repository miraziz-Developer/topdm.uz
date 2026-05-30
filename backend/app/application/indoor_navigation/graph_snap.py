from __future__ import annotations

import math
from typing import Any


def nearest_navigation_graph_node(graph: dict[str, Any], x: float, y: float) -> str | None:
    """Pick closest walkable graph node (entrance/corridor) to a map point; fallback to any node."""
    nodes = graph.get("nodes") or {}
    if not isinstance(nodes, dict) or not nodes:
        return None

    def dist(meta: dict[str, Any]) -> float:
        nx = float(meta.get("x", 0))
        ny = float(meta.get("y", 0))
        return math.hypot(nx - x, ny - y)

    preferred: list[tuple[float, str]] = []
    fallback: list[tuple[float, str]] = []
    for node_id, meta in nodes.items():
        if not isinstance(meta, dict):
            continue
        kind = meta.get("kind")
        d = dist(meta)
        if kind == "stall":
            fallback.append((d, str(node_id)))
        else:
            preferred.append((d, str(node_id)))

    pool = preferred if preferred else fallback
    if not pool:
        return None
    pool.sort(key=lambda item: item[0])
    return pool[0][1]


def snap_point_to_grid(x: float, y: float, step: float = 8.0) -> tuple[float, float]:
    return round(x / step) * step, round(y / step) * step


def snap_stall_to_navigation_graph(
    graph: dict[str, Any],
    center_x: float,
    center_y: float,
    *,
    grid_step: float = 8.0,
) -> tuple[float, float, str | None]:
    """Snap stall center to grid, then align to nearest walkable navigation node."""
    gx, gy = snap_point_to_grid(center_x, center_y, grid_step)
    node_id = nearest_navigation_graph_node(graph, gx, gy)
    nodes = graph.get("nodes") or {}
    if node_id and isinstance(nodes.get(node_id), dict):
        meta = nodes[node_id]
        return float(meta.get("x", gx)), float(meta.get("y", gy)), str(node_id)
    return gx, gy, node_id
