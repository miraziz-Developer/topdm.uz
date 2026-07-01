from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.map.map_stores_service import MapStoresService
from app.infrastructure.db.session import get_db_session
from app.schemas.merchants import MapStoresResponse

router = APIRouter(prefix="/map", tags=["map"])


@router.get("/stores", response_model=MapStoresResponse)
async def list_map_stores(
    market_slug: str = "ippodrom",
    db: AsyncSession = Depends(get_db_session),
) -> MapStoresResponse:
    """GeoJSON + flat store list for global map POI hydration (Redis-cached)."""
    service = MapStoresService(db)
    payload = await service.get_stores_geojson(market_slug=market_slug)
    return MapStoresResponse.model_validate(payload)
