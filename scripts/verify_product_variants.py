#!/usr/bin/env python3
"""Quick check: product variant catalog build/parse (no pytest required)."""

from __future__ import annotations

import sys
from pathlib import Path

_root = Path(__file__).resolve().parents[1]
_backend = _root / "backend"
sys.path.insert(0, str(_backend))

from app.application.merchant.product_variants import build_attributes_from_catalog, parse_variant_catalog


def main() -> int:
    catalog = {
        "all_sizes": ["S", "M", "L"],
        "colors": [
            {"name": "Qora", "sizes": ["S", "M"], "image_urls": ["/q.jpg"]},
            {"name": "Oq", "sizes": ["L"], "image_urls": []},
        ],
        "sku_stock": {"qora|s": 3, "qora|m": 1, "oq|l": 5},
    }
    attrs, total = build_attributes_from_catalog(catalog)
    assert total == 9, total
    parsed = parse_variant_catalog(attrs)
    assert parsed["sku_stock"].get("qora|s") == 3
    assert parsed["size_matrix"]["Qora"] == ["S", "M"]
    print("PASS product variants")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
