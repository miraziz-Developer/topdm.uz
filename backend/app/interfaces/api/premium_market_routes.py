from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.premium_market.auto_china_engine import AutoChinaMarketEngine, AutoChinaMarketError
from app.application.premium_market import PremiumMarketService
from app.application.premium_market.service import PremiumMarketError
from app.core.config import get_settings
from app.infrastructure.db.session import get_db_session
from app.schemas.premium_market import (
    MarketAutoSearchResponse,
    MarketChinaCatalogResponse,
    MarketChinaImportResponse,
    MarketChinaResponse,
    MarketLocalResponse,
)

def _require_china_market() -> None:
    if not get_settings().enable_china_market:
        raise HTTPException(status_code=404, detail="Xitoy bozori vaqtincha yopiq")


router = APIRouter(
    prefix="/market",
    tags=["premium-market"],
    dependencies=[Depends(_require_china_market)],
)


def _auto_error(exc: AutoChinaMarketError) -> HTTPException:
    status = 400 if exc.code == "invalid_query" else 404 if exc.code == "not_found" else 502
    if exc.code == "config_missing":
        status = 503
    elif exc.code == "not_subscribed":
        status = 403
    elif exc.code == "rate_limit":
        status = 429
    return HTTPException(status_code=status, detail=str(exc))


def _premium_error(exc: PremiumMarketError) -> HTTPException:
    status = 404 if exc.code == "not_found" else 400 if exc.code == "invalid_id" else 502
    if exc.code == "config_missing":
        status = 503
    return HTTPException(status_code=status, detail=str(exc))


@router.get("/auto-search", response_model=MarketAutoSearchResponse)
async def auto_search_china_products(
    q: str = Query(..., min_length=1, max_length=200, description="O'zbekcha qidiruv"),
    page: int = Query(1, ge=1, le=20),
) -> MarketAutoSearchResponse:
    engine = AutoChinaMarketEngine(get_settings())
    try:
        return await engine.auto_discover_products(q, page=page)
    except AutoChinaMarketError as exc:
        raise _auto_error(exc) from exc


@router.get("/china/catalog", response_model=MarketChinaCatalogResponse)
async def list_china_market_catalog(
    ids: str | None = Query(
        None,
        description="Qo'shimcha Taobao ID (vergul bilan). Asosiy ro'yxat .env dan.",
    ),
    db: AsyncSession = Depends(get_db_session),
) -> MarketChinaCatalogResponse:
    extra = [x.strip() for x in (ids or "").split(",") if x.strip()] if ids else None
    service = PremiumMarketService(db)
    try:
        return await service.list_china_catalog(extra_ids=extra)
    except PremiumMarketError as exc:
        raise _premium_error(exc) from exc


@router.get("/china/import/{item_id}", response_model=MarketChinaImportResponse)
async def import_china_market_item(
    item_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> MarketChinaImportResponse:
    service = PremiumMarketService(db)
    try:
        item = await service.import_china_catalog_item(item_id)
        return MarketChinaImportResponse(item=item)
    except PremiumMarketError as exc:
        raise _premium_error(exc) from exc


@router.get("/china/{item_id}", response_model=MarketChinaResponse)
async def get_china_market_product(
    item_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> MarketChinaResponse:
    service = PremiumMarketService(db)
    try:
        return await service.get_china_product(item_id)
    except PremiumMarketError as exc:
        raise _premium_error(exc) from exc


@router.get("/local/{item_id}", response_model=MarketLocalResponse)
async def get_local_market_product(
    item_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> MarketLocalResponse:
    service = PremiumMarketService(db)
    try:
        return await service.get_local_product(item_id)
    except PremiumMarketError as exc:
        status = 404 if exc.code == "not_found" else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc
