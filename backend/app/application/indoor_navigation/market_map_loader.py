from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.indoor_navigation.fixtures import DEFAULT_MARKET_PLANS
from app.infrastructure.repositories.indoor_map_repo import IndoorMapRepository


def normalize_market_slug(slug: str) -> str:
    return slug.lower().strip()


def fallback_market_plan(market_slug: str) -> dict:
    key = normalize_market_slug(market_slug)
    return DEFAULT_MARKET_PLANS.get(key, DEFAULT_MARKET_PLANS["ippodrom"])


async def load_market_map(market_slug: str, db: AsyncSession) -> dict:
    repo = IndoorMapRepository(db)
    market = await repo.get_market_by_slug(market_slug)
    if market:
        floor_plans = await repo.list_floor_plans(market.id)
        if floor_plans:
            levels = []
            for plan in floor_plans:
                stalls = await repo.list_stalls(plan.id)
                levels.append(repo.floor_plan_to_dict(plan, stalls))
            return {
                "market_id": str(market.id),
                "slug": normalize_market_slug(market_slug),
                "name": market.name,
                "source": "database",
                "levels": levels,
            }

    plan = fallback_market_plan(market_slug)
    return {**plan, "source": "fixture"}
