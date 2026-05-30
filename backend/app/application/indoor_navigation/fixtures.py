from __future__ import annotations

IPPODROM_LEVEL_1_GRAPH = {
    "nodes": {
        "entrance-A": {"id": "entrance-A", "x": 61, "y": 248, "kind": "entrance"},
        "entrance-B": {"id": "entrance-B", "x": 159, "y": 248, "kind": "entrance"},
        "entrance-C": {"id": "entrance-C", "x": 257, "y": 248, "kind": "entrance"},
        "entrance-D": {"id": "entrance-D", "x": 355, "y": 248, "kind": "entrance"},
        "corridor-A": {"id": "corridor-A", "x": 61, "y": 206, "kind": "corridor"},
        "corridor-B": {"id": "corridor-B", "x": 159, "y": 206, "kind": "corridor"},
        "corridor-C": {"id": "corridor-C", "x": 257, "y": 206, "kind": "corridor"},
        "corridor-D": {"id": "corridor-D", "x": 355, "y": 206, "kind": "corridor"},
    },
    "edges": [
        {"from": "entrance-A", "to": "corridor-A", "weight": 1.2},
        {"from": "entrance-B", "to": "corridor-B", "weight": 1.2},
        {"from": "entrance-C", "to": "corridor-C", "weight": 1.2},
        {"from": "entrance-D", "to": "corridor-D", "weight": 1.2},
        {"from": "corridor-A", "to": "corridor-B", "weight": 1.5},
        {"from": "corridor-B", "to": "corridor-C", "weight": 1.5},
        {"from": "corridor-C", "to": "corridor-D", "weight": 1.5},
    ],
}

BLOCKS = ["A", "B", "C", "D"]
STALL_CODES = ["08", "12", "16", "20", "24", "28"]


def _build_stalls(level: int, occupied: dict[str, list[str]]) -> list[dict]:
    stalls: list[dict] = []
    for block_index, block in enumerate(BLOCKS):
        x_base = 20 + block_index * 98
        for stall_index, code in enumerate(STALL_CODES):
            row = stall_index // 2
            col = stall_index % 2
            x = x_base + 12 + col * 34
            y = 58 + row * 34
            node_id = f"stall-{block}-{code}"
            stalls.append(
                {
                    "id": f"ippodrom-f{level}-{block}-{code}",
                    "stall_code": code,
                    "block_code": block,
                    "status": "occupied" if code in occupied.get(block, []) else "vacant",
                    "local_x": x,
                    "local_y": y,
                    "width": 28,
                    "height": 24,
                    "graph_node_id": node_id,
                    "shop_id": None,
                    "geometry": {"type": "Point", "coordinates": [x + 14, y + 12]},
                },
            )
    return stalls


def _attach_stall_nodes(graph: dict, stalls: list[dict]) -> dict:
    nodes = dict(graph["nodes"])
    edges = list(graph["edges"])
    for stall in stalls:
        node_id = stall["graph_node_id"]
        nodes[node_id] = {
            "id": node_id,
            "x": stall["local_x"] + stall["width"] / 2,
            "y": stall["local_y"] + stall["height"] / 2,
            "kind": "stall",
        }
        edges.append({"from": f"corridor-{stall['block_code']}", "to": node_id, "weight": 1})
    return {"nodes": nodes, "edges": edges}


def _build_level(level: int, label: str, occupied: dict[str, list[str]]) -> dict:
    stalls = _build_stalls(level, occupied)
    graph = _attach_stall_nodes(IPPODROM_LEVEL_1_GRAPH, stalls)
    return {
        "id": f"ippodrom-level-{level}",
        "level": level,
        "name": label,
        "slug": f"ippodrom-level-{level}",
        "view_box": "0 0 420 260",
        "geojson": {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"kind": "block", "label": f"{block}-blok"},
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [20 + index * 98, 28],
                            [20 + index * 98 + 82, 28],
                            [20 + index * 98 + 82, 192],
                            [20 + index * 98, 192],
                            [20 + index * 98, 28],
                        ]],
                    },
                }
                for index, block in enumerate(BLOCKS)
            ],
        },
        "navigation_graph": graph,
        "svg_overlay_url": None,
        "stalls": stalls,
    }


MARKET_GEOFENCES: dict[str, dict] = {
    "ippodrom": {
        "center": {"lat": 41.2346, "lng": 69.1834},
        "radius_m": 220,
        "accuracy_target_m": 5,
        "polygon": [
            {"lat": 41.2325, "lng": 69.1750},
            {"lat": 41.2325, "lng": 69.1855},
            {"lat": 41.2395, "lng": 69.1855},
            {"lat": 41.2395, "lng": 69.1750},
        ],
    },
    "abu-saxiy": {
        "center": {"lat": 41.2381, "lng": 69.1765},
        "radius_m": 260,
        "accuracy_target_m": 5,
        "polygon": [
            {"lat": 41.2365, "lng": 69.1745},
            {"lat": 41.2365, "lng": 69.1785},
            {"lat": 41.2395, "lng": 69.1785},
            {"lat": 41.2395, "lng": 69.1745},
        ],
    },
    "dordoy": {
        "center": {"lat": 41.24, "lng": 69.21},
        "radius_m": 320,
        "accuracy_target_m": 5,
        "polygon": [
            {"lat": 41.237, "lng": 69.206},
            {"lat": 41.237, "lng": 69.214},
            {"lat": 41.243, "lng": 69.214},
            {"lat": 41.243, "lng": 69.206},
        ],
    },
}


def get_market_geofence(market_slug: str) -> dict:
    key = market_slug.lower().strip()
    return MARKET_GEOFENCES.get(key, MARKET_GEOFENCES["ippodrom"])


DEFAULT_MARKET_PLANS: dict[str, dict] = {
    "ippodrom": {
        "market_id": "ippodrom",
        "slug": "ippodrom",
        "name": "Ippodrom",
        "levels": [
            _build_level(1, "1-qavat", {"A": ["08", "12"], "B": ["16", "20"], "C": ["24"], "D": ["28"]}),
            _build_level(2, "2-qavat", {"A": ["12", "16"], "B": ["08"], "C": ["20", "24"], "D": ["28"]}),
        ],
    },
    "abu-saxiy": {
        "market_id": "abu-saxiy",
        "slug": "abu-saxiy",
        "name": "Abu Saxiy",
        "levels": [
            {
                "id": "abu-saxiy-level-1",
                "level": 1,
                "name": "1-qavat",
                "slug": "abu-saxiy-level-1",
                "view_box": "0 0 420 260",
                "geojson": {"type": "FeatureCollection", "features": []},
                "navigation_graph": IPPODROM_LEVEL_1_GRAPH,
                "svg_overlay_url": None,
                "stalls": [],
            },
        ],
    },
    "dordoy": {
        "market_id": "dordoy",
        "slug": "dordoy",
        "name": "Dordoy",
        "levels": [
            {
                "id": "dordoy-level-1",
                "level": 1,
                "name": "1-qavat",
                "slug": "dordoy-level-1",
                "view_box": "0 0 420 260",
                "geojson": {"type": "FeatureCollection", "features": []},
                "navigation_graph": IPPODROM_LEVEL_1_GRAPH,
                "svg_overlay_url": None,
                "stalls": [],
            },
        ],
    },
}
