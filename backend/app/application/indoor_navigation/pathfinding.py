from __future__ import annotations

import heapq
import math
from typing import Any


def _heuristic(a: dict[str, Any], b: dict[str, Any]) -> float:
    return math.hypot(float(a["x"]) - float(b["x"]), float(a["y"]) - float(b["y"]))


def _edge_weight(graph: dict[str, Any], left: str, right: str) -> float:
    nodes = graph.get("nodes") or {}
    if left not in nodes or right not in nodes:
        return math.inf
    for edge in graph.get("edges", []):
        if (edge.get("from") == left and edge.get("to") == right) or (
            edge.get("from") == right and edge.get("to") == left
        ):
            if edge.get("weight") is not None:
                return float(edge["weight"])
    a = nodes[left]
    b = nodes[right]
    return math.hypot(float(a["x"]) - float(b["x"]), float(a["y"]) - float(b["y"]))


def _neighbors(graph: dict[str, Any], node_id: str) -> list[str]:
    nodes = graph.get("nodes") or {}
    neighbors: list[str] = []
    for edge in graph.get("edges", []):
        src, dst = edge.get("from"), edge.get("to")
        if src == node_id and dst in nodes:
            neighbors.append(dst)
        elif dst == node_id and src in nodes:
            neighbors.append(src)
    return neighbors


def route_failure_reason(graph: dict[str, Any], start_id: str, goal_id: str) -> str | None:
    """None when a route may exist; otherwise a machine-readable reason."""
    nodes = graph.get("nodes") or {}
    if not nodes:
        return "empty_graph"
    if start_id not in nodes:
        return "unknown_start_node"
    if goal_id not in nodes:
        return "unknown_goal_node"
    if start_id == goal_id:
        return None
    path = find_shortest_path(graph, start_id, goal_id)
    if not path:
        return "disconnected_graph"
    return None


def find_shortest_path(graph: dict[str, Any], start_id: str, goal_id: str) -> list[str]:
    nodes = graph.get("nodes") or {}
    if start_id not in nodes or goal_id not in nodes:
        return []
    if start_id == goal_id:
        return [start_id]

    open_heap: list[tuple[float, str]] = [(0.0, start_id)]
    came_from: dict[str, str] = {}
    g_score: dict[str, float] = {start_id: 0.0}
    visited: set[str] = set()

    while open_heap:
        _, current = heapq.heappop(open_heap)
        if current in visited:
            continue
        visited.add(current)
        if current == goal_id:
            path = [current]
            while current in came_from:
                current = came_from[current]
                path.insert(0, current)
            return path

        for neighbor in _neighbors(graph, current):
            if neighbor in visited:
                continue
            weight = _edge_weight(graph, current, neighbor)
            if math.isinf(weight):
                continue
            tentative = g_score[current] + weight
            if tentative >= g_score.get(neighbor, math.inf):
                continue
            came_from[neighbor] = current
            g_score[neighbor] = tentative
            score = tentative + _heuristic(nodes[neighbor], nodes[goal_id])
            heapq.heappush(open_heap, (score, neighbor))

    return []


def build_route(graph: dict[str, Any], start_id: str, goal_id: str) -> dict[str, Any]:
    reason = route_failure_reason(graph, start_id, goal_id)
    if reason:
        return {"node_ids": [], "points": [], "distance": 0.0, "error": reason}
    node_ids = find_shortest_path(graph, start_id, goal_id)
    nodes = graph.get("nodes") or {}
    points = [
        {"x": float(nodes[node_id]["x"]), "y": float(nodes[node_id]["y"])}
        for node_id in node_ids
        if node_id in nodes
    ]
    distance = 0.0
    for index in range(1, len(points)):
        distance += math.hypot(points[index]["x"] - points[index - 1]["x"], points[index]["y"] - points[index - 1]["y"])
    return {"node_ids": node_ids, "points": points, "distance": distance}
