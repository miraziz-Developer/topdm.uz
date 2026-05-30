"""Map market_slug → DB market_zone filter (case-insensitive substring)."""

from __future__ import annotations

MARKET_SLUG_ZONES: dict[str, str] = {
    "ippodrom": "Ippodrom",
    "abu-sahiy": "Abu Sahiy",
    "chorsu": "Chorsu",
    "kozgalovka": "Kozgalovka",
}

MARKET_SLUG_LABELS: dict[str, str] = {
    "ippodrom": "Ippodrom",
    "abu-sahiy": "Abu Sahiy",
    "chorsu": "Chorsu bozori",
    "kozgalovka": "Kozgalovka",
}


def market_zone_for_slug(market_slug: str) -> str | None:
    key = (market_slug or "ippodrom").strip().lower()
    return MARKET_SLUG_ZONES.get(key)
