from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.personalization.rule_engine import UserSignals, evaluate_experience
from app.infrastructure.auth.deps import AuthUser
from app.infrastructure.auth.merchant_resolve import customer_phone_for_user
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository

ACTIVE_STATUSES = frozenset({"pending", "reserved", "confirmed", "preparing", "ready", "new"})
COMPLETED_STATUSES = frozenset({"completed"})

MARKET_SLUG_MAP = {
    "ippodrom": "Ippodrom",
    "abu-saxiy": "Abu Sahiy",
    "abu saxiy": "Abu Sahiy",
    "kozgalovka": "Kozgalovka",
}


def _normalize_market_zone(raw: str | None) -> str | None:
    if not raw or raw.lower() in ("all", ""):
        return None
    key = raw.lower().strip().replace(" ", "-")
    return MARKET_SLUG_MAP.get(key, raw.strip())


async def build_user_signals(
    db: AsyncSession,
    *,
    user: AuthUser | None,
    client: dict[str, Any] | None,
) -> UserSignals:
    hints = client or {}
    sale = str(hints.get("sale_mode") or "").strip()
    signals = UserSignals(
        is_logged_in=user is not None,
        visit_count=max(1, int(hints.get("visit_count") or 1)),
        last_shop_slug=(str(hints["last_shop_slug"]).strip() if hints.get("last_shop_slug") else None),
        last_shop_name=(str(hints["last_shop_name"]).strip() if hints.get("last_shop_name") else None),
        preferred_market=_normalize_market_zone(str(hints.get("preferred_market") or "") or None),
        locale=str(hints.get("locale") or "uz")[:8],
        liked_products_count=max(
            int(hints.get("liked_products_count") or 0),
            int(hints.get("favorites_count") or 0),
        ),
        recent_views_count=int(hints.get("recent_views_count") or 0),
        is_merchant=bool(user and str(user.role or "").lower() == "merchant"),
        sale_mode=sale if sale in ("Chakana", "Optom") else None,
    )

    phone: str | None = None
    if user:
        phone = await customer_phone_for_user(db, user)
        signals.has_phone = bool(phone)
    elif hints.get("guest_phone"):
        signals.has_phone = True
        phone = str(hints["guest_phone"]).strip()

    repo = MarketplaceRepository(db)
    if phone:
        orders = await repo.list_customer_orders(phone, limit=30)
        active = [o for o in orders if (o.status or "").lower() in ACTIVE_STATUSES]
        done = [o for o in orders if (o.status or "").lower() in COMPLETED_STATUSES]
        signals.total_orders_count = len(orders)
        signals.active_orders_count = len(active)
        signals.completed_orders_count = len(done)
        signals.has_active_reservation = len(active) > 0

        if active:
            order = active[0]
            shop = order.shop
            if shop and shop.slug:
                signals.last_shop_slug = signals.last_shop_slug or shop.slug
                signals.last_shop_name = signals.last_shop_name or shop.name
                params = f"merchant_id={shop.id}&shop={shop.slug}&focus=true&source=order"
                if order.id:
                    params += f"&order_id={order.id}"
                signals.active_order_map_href = f"/map?{params}"

    if signals.last_shop_slug and not signals.last_shop_name:
        shop = await repo.get_shop_by_slug(signals.last_shop_slug)
        if shop:
            signals.last_shop_name = shop.name

    return signals


async def get_home_experience(
    db: AsyncSession,
    *,
    user: AuthUser | None,
    client: dict[str, Any] | None,
) -> dict[str, Any]:
    from app.core.config import get_settings

    signals = await build_user_signals(db, user=user, client=client)
    payload = evaluate_experience(signals)
    if payload.get("rule_id") == "merchant_redirect":
        crm_url = get_settings().merchant_crm_webapp_url.rstrip("/")
        for cta in payload.get("ctas") or []:
            if cta.get("id") == "crm":
                cta["href"] = f"{crm_url}/login"
    payload["personalized"] = True
    payload["algorithm_version"] = "2025-05-v2"
    return payload
