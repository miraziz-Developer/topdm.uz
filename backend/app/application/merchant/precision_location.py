from __future__ import annotations

from fastapi import HTTPException

from app.application.indoor_navigation.fixtures import get_market_geofence
from app.application.indoor_navigation.geofence import geofence_status


def assert_gps_inside_market(latitude: float, longitude: float, market_slug: str) -> None:
    """Raise HTTP 400 if GPS is outside the configured bazaar geofence (e.g. Ippodrom)."""
    status = geofence_status(latitude, longitude, get_market_geofence(market_slug))
    if not status["inside"]:
        raise HTTPException(
            status_code=400,
            detail="Siz bozor hududida emassiz, iltimos do'koningizda turib joylashuvni aniqlang.",
        )
