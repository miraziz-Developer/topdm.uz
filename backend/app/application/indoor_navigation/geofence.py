from __future__ import annotations

import math
from typing import Any


def _deg_to_meters_lat(delta: float) -> float:
    return delta * 111_320.0


def _deg_to_meters_lng(delta: float, latitude: float) -> float:
    return delta * 111_320.0 * math.cos(math.radians(latitude))


def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6_371_000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def point_in_polygon(lat: float, lng: float, polygon: list[dict[str, float]]) -> bool:
    inside = False
    count = len(polygon)
    for index in range(count):
        current = polygon[index]
        previous = polygon[index - 1]
        lat_i = current["lat"]
        lng_i = current["lng"]
        lat_j = previous["lat"]
        lng_j = previous["lng"]
        intersects = (lng_i > lng) != (lng_j > lng) and lat < (
            (lat_j - lat_i) * (lng - lng_i) / ((lng_j - lng_i) or 1e-12) + lat_i
        )
        if intersects:
            inside = not inside
    return inside


def geofence_status(lat: float, lng: float, geofence: dict[str, Any]) -> dict[str, Any]:
    polygon = geofence.get("polygon") or []
    center = geofence.get("center") or {}
    center_lat = float(center.get("lat", 0))
    center_lng = float(center.get("lng", 0))
    radius_m = float(geofence.get("radius_m", 0))
    inside = point_in_polygon(lat, lng, polygon) if polygon else False
    distance_m = haversine_meters(lat, lng, center_lat, center_lng) if center_lat and center_lng else None
    if not inside and radius_m and distance_m is not None:
        inside = distance_m <= radius_m
    return {
        "inside": inside,
        "distance_m": round(distance_m, 1) if distance_m is not None else None,
        "accuracy_target_m": float(geofence.get("accuracy_target_m", 5)),
    }


def gps_to_local_point(
    lat: float,
    lng: float,
    geofence: dict[str, Any],
    view_box: tuple[float, float, float, float] = (0.0, 0.0, 420.0, 260.0),
) -> dict[str, float]:
    polygon = geofence.get("polygon") or []
    if polygon:
        lats = [point["lat"] for point in polygon]
        lngs = [point["lng"] for point in polygon]
    else:
        center = geofence.get("center") or {}
        center_lat = float(center.get("lat", lat))
        center_lng = float(center.get("lng", lng))
        radius_m = float(geofence.get("radius_m", 180))
        lat_delta = radius_m / 111_320.0
        lng_delta = radius_m / max(_deg_to_meters_lng(1.0, center_lat), 1.0)
        lats = [center_lat - lat_delta, center_lat + lat_delta]
        lngs = [center_lng - lng_delta, center_lng + lng_delta]

    min_lat, max_lat = min(lats), max(lats)
    min_lng, max_lng = min(lngs), max(lngs)
    x0, y0, width, height = view_box
    ratio_x = 0 if max_lng == min_lng else (lng - min_lng) / (max_lng - min_lng)
    ratio_y = 0 if max_lat == min_lat else (lat - min_lat) / (max_lat - min_lat)
    x = x0 + ratio_x * width
    y = y0 + (1 - ratio_y) * height
    return {
        "x": round(max(x0, min(x0 + width, x)), 1),
        "y": round(max(y0, min(y0 + height, y)), 1),
    }
