"""Real-world WGS84 anchors for Chilonzor Ippodrom / Abu Saxiy bazaar cluster."""

# Chilonzor Buyum Bozori (Ippodrom) — core map center
IPPODROM_CENTER_LAT = 41.2346
IPPODROM_CENTER_LNG = 69.1834

# Abu Saxiy wholesale quarter entrance node
ABU_SAXIY_NODE_LAT = 41.2381
ABU_SAXIY_NODE_LNG = 69.1765

# Indoor floor-plan (420×260 px) projects into this WGS84 bounding box
IPPODROM_WGS84_BOUNDS = {
    "min_lat": 41.2325,
    "max_lat": 41.2395,
    "min_lng": 69.1750,
    "max_lng": 69.1855,
}

IPPODROM_INDOOR_WIDTH = 420.0
IPPODROM_INDOOR_HEIGHT = 260.0

# Geofence polygon (Ippodrom + adjacent wholesale rows)
IPPODROM_GEOFENCE_POLYGON = [
    {"lat": 41.2325, "lng": 69.1750},
    {"lat": 41.2325, "lng": 69.1855},
    {"lat": 41.2395, "lng": 69.1855},
    {"lat": 41.2395, "lng": 69.1750},
]
