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


def normalize_market_slug(market_slug: str) -> str:
    return (market_slug or "ippodrom").strip().lower()


def default_market_zone_label(market_slug: str) -> str | None:
    """Canonical DB label when merchant saves GPS but market_zone was never set."""
    return MARKET_SLUG_ZONES.get(normalize_market_slug(market_slug))
