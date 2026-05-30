"""Recent order categories for stylist personalization."""

from __future__ import annotations

import re

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository

_PHONE_RE = re.compile(r"^\+?\d{9,15}$")


async def load_recent_order_categories(
    db: AsyncSession,
    user_key: str,
    *,
    limit: int = 8,
) -> list[str]:
    """
    If user_key looks like a phone, pull recent order line categories for profile context.
    """
    key = (user_key or "").strip().replace(" ", "")
    if not key or not _PHONE_RE.match(key):
        return []

    repo = MarketplaceRepository(db)
    try:
        orders = await repo.list_customer_orders(key, limit=5)
    except Exception:
        return []

    cats: list[str] = []
    for order in orders:
        product = getattr(order, "product", None)
        if product:
            name = str(getattr(product, "name", None) or "")
            if name and name not in cats:
                cats.append(name[:48])
        if len(cats) >= limit:
            return cats
    return cats
