from __future__ import annotations

import re
from typing import Any

from app.application.map.geo_anchors import (
    IPPODROM_INDOOR_HEIGHT,
    IPPODROM_INDOOR_WIDTH,
    IPPODROM_WGS84_BOUNDS,
)
from app.application.map.merchant_location import parse_merchant_location

BLOCKS = ("A", "B", "C", "D")
STALL_SLOTS = ("08", "12", "16", "20", "24", "28")


def _ipadrom_name(shop) -> str:
    if shop is None:
        return "Ippodrom"
    ipadrom = getattr(shop, "ipadrom", None)
    if ipadrom and getattr(ipadrom, "name", None):
        return str(ipadrom.name).replace(" bozori", "").replace(" bozor", "").strip() or "Ippodrom"
    return "Ippodrom"


def indoor_pixel_to_wgs84(map_x: float, map_y: float) -> tuple[float, float]:
    """Project local floor-plan pixels into Ippodrom geofence lat/lng."""
    bx = IPPODROM_WGS84_BOUNDS
    lat_span = bx["max_lat"] - bx["min_lat"]
    lng_span = bx["max_lng"] - bx["min_lng"]
    x_ratio = max(0.0, min(1.0, map_x / IPPODROM_INDOOR_WIDTH))
    y_ratio = max(0.0, min(1.0, map_y / IPPODROM_INDOOR_HEIGHT))
    lat = bx["max_lat"] - y_ratio * lat_span
    lng = bx["min_lng"] + x_ratio * lng_span
    return round(lat, 7), round(lng, 7)


def parse_shop_spatial(shop) -> dict[str, Any]:
    """Indoor grid + koordinata uchun (A–D blok zaxirasi)."""
    loc = parse_merchant_location(shop)
    block = loc["block_id"] or "B"
    if block not in BLOCKS:
        block = "B"
    stall = loc["stall_number"]
    if stall == "—":
        stall = str(8 + (ord(block) % 4) * 3)
    floor = loc["floor_level"] if loc["floor_level"] is not None else 1
    return {
        "block_id": block,
        "stall_number": stall,
        "floor": floor,
        "address_label": loc["address_label"],
    }


def block_index(block: str) -> int:
    block = block.upper()
    return BLOCKS.index(block) if block in BLOCKS else 1


def stall_map_point(block_id: str, stall_number: str) -> tuple[float, float]:
    block_idx = block_index(block_id)
    x_base = 20 + block_idx * 98
    try:
        numeric = int(stall_number)
    except (TypeError, ValueError):
        numeric = block_idx
    slot = numeric % len(STALL_SLOTS)
    row = slot // 2
    col = slot % 2
    x = x_base + 12 + col * 34 + 14
    y = 58 + row * 34 + 12
    return float(x), float(y)


def resolve_map_coordinates(shop) -> tuple[float, float]:
    pin_x = getattr(shop, "indoor_pin_x", None)
    pin_y = getattr(shop, "indoor_pin_y", None)
    if pin_x is not None and pin_y is not None:
        return float(pin_x), float(pin_y)
    spatial = parse_shop_spatial(shop)
    return stall_map_point(spatial["block_id"], spatial["stall_number"])


def resolve_wgs84_coordinates(shop, map_x: float, map_y: float) -> tuple[float, float]:
    lat = getattr(shop, "latitude", None)
    lng = getattr(shop, "longitude", None)
    if lat is not None and lng is not None and abs(float(lat)) > 1 and abs(float(lng)) > 1:
        # Reject legacy central-Tashkent seed coordinates (National Park / Xalqlar Do'stligi)
        if float(lat) > 41.28 or float(lng) > 69.22:
            return indoor_pixel_to_wgs84(map_x, map_y)
        return float(lat), float(lng)
    return indoor_pixel_to_wgs84(map_x, map_y)


def shop_to_map_store(shop) -> dict[str, Any]:
    spatial = parse_shop_spatial(shop)
    map_x, map_y = resolve_map_coordinates(shop)
    latitude, longitude = resolve_wgs84_coordinates(shop, map_x, map_y)
    market = _ipadrom_name(shop)
    status = "active" if getattr(shop, "is_active", True) else "inactive"
    rating = float(getattr(shop, "rating", 0) or 0)
    review_count = int(getattr(shop, "review_count", 0) or 0)

    loc = parse_merchant_location(shop)

    store_id = str(shop.id)
    return {
        "id": store_id,
        "name": shop.name,
        "slug": shop.slug,
        "logo_url": getattr(shop, "logo_url", None),
        "latitude": latitude,
        "longitude": longitude,
        "floor": spatial["floor"],
        "block_id": spatial["block_id"],
        "stall_number": spatial["stall_number"],
        "shop_number": loc["shop_number"] or spatial["stall_number"],
        "status": status,
        "rating": round(rating, 1),
        "review_count": review_count,
        "ipadrom": loc["market_zone"] or market,
        "market_zone": loc["market_zone"],
        "building": loc["building"],
        "block_id_letter": loc["block_id"],
        "row_label": loc["row_label"],
        "floor_level_label": f"{loc['floor_level']}-qavat" if loc["floor_level"] else None,
        "address_label": loc["address_label"],
        "location_comment": loc["location_comment"],
        "map_x": map_x,
        "map_y": map_y,
    }


def stores_to_geojson(stores: list[dict[str, Any]]) -> dict[str, Any]:
    features = []
    for store in stores:
        lat = store["latitude"]
        lng = store["longitude"]
        features.append(
            {
                "type": "Feature",
                "id": store["id"],
                "geometry": {
                    "type": "Point",
                    "coordinates": [lng, lat],
                },
                "properties": {
                    "id": store["id"],
                    "name": store["name"],
                    "slug": store["slug"],
                    "logo_url": store.get("logo_url"),
                    "block_id": store["block_id"],
                    "stall_number": store["stall_number"],
                    "floor": store["floor"],
                    "status": store["status"],
                    "rating": store["rating"],
                    "address_label": store["address_label"],
                },
            }
        )
    return {
        "type": "FeatureCollection",
        "features": features,
        "stores": stores,
    }
