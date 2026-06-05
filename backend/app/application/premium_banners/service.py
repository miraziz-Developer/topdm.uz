from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.infrastructure.repositories.premium_banner_repo import PremiumBannerRepository
from app.models.premium_banner import SponsoredBannerModel


def _banner_to_slide(banner: SponsoredBannerModel) -> dict[str, Any]:
    shop = banner.shop
    tariff = banner.tariff
    product = banner.product
    slug = shop.slug if shop else ""
    rating = float(shop.rating or 0) if shop else 0.0
    title = (banner.title or "").strip() or (product.name if product else shop.name if shop else "Trend")
    cta = banner.cta_path or (f"/shop/{slug}" if slug else "/search")
    if not cta.startswith("/"):
        cta = f"/{cta}"
    return {
        "id": str(banner.id),
        "shop_id": str(banner.shop_id),
        "shop_name": shop.name if shop else "Do'kon",
        "shop_slug": slug,
        "rating": round(rating, 1),
        "image_url": banner.image_url,
        "headline": title,
        "tariff_code": tariff.code if tariff else "bronze",
        "tariff_label": tariff.name_uz if tariff else "Bronze",
        "priority_weight": int(tariff.priority_weight) if tariff else 1,
        "dwell_ms": int(tariff.dwell_ms) if tariff else 4500,
        "frame_style": tariff.frame_style if tariff else "standard",
        "badge_label": tariff.badge_label,
        "cta_url": cta,
        "ipadrom": getattr(shop, "market_zone", None) or "Ippodrom",
        "location_label": shop.section or shop.floor if shop else None,
    }


def build_weighted_carousel_slides(banners: list[SponsoredBannerModel]) -> list[dict[str, Any]]:
    """Expand by tariff weight, shuffle within tier, Gold first on load."""
    if not banners:
        return []

    by_weight: dict[int, list[SponsoredBannerModel]] = {}
    for b in banners:
        w = int(b.tariff.priority_weight) if b.tariff else 1
        by_weight.setdefault(w, []).append(b)

    ordered_slides: list[dict[str, Any]] = []
    for weight in sorted(by_weight.keys(), reverse=True):
        pool = list(by_weight[weight])
        random.shuffle(pool)
        for banner in pool:
            slide = _banner_to_slide(banner)
            repeat = max(1, weight)
            for _ in range(repeat):
                ordered_slides.append({**slide, "rotation_key": slide["id"]})

    gold_first: list[dict[str, Any]] = []
    rest: list[dict[str, Any]] = []
    for slide in ordered_slides:
        if slide.get("tariff_code") == "gold":
            gold_first.append(slide)
        else:
            rest.append(slide)
    if gold_first:
        random.shuffle(gold_first)
        return gold_first + rest
    return ordered_slides


class PremiumBannerService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = PremiumBannerRepository(session)
        self._marketplace = MarketplaceRepository(session)

    async def get_home_carousel(self, *, limit: int = 24) -> dict[str, Any]:
        from app.application.crm_banners.expiration import run_banner_expiration_once
        from app.infrastructure.cache.premium_carousel_cache import PremiumCarouselCache

        cache = PremiumCarouselCache()
        carousel_cfg = await cache.get_config()
        version = await cache.get_version()

        expired = await run_banner_expiration_once(self._session)
        if expired:
            version = await cache.bump_invalidation()

        banners = await self._repo.list_active_banners(limit=limit)
        base: dict[str, Any] = {
            "carousel": carousel_cfg,
            "carousel_version": version,
        }
        if banners:
            slides = build_weighted_carousel_slides(banners)
            dwell = max((s.get("dwell_ms") or 4500 for s in slides), default=4500)
            interval = int(carousel_cfg.get("interval_ms") or min(dwell, 5500))
            unique = {s["rotation_key"]: s for s in slides}
            if not carousel_cfg.get("enabled", True):
                return {**base, "source": "disabled", "rotation_interval_ms": interval, "items": [], "slides": []}
            return {
                **base,
                "source": "sponsored",
                "rotation_interval_ms": interval,
                "items": list(unique.values()),
                "slides": slides[: max(limit * 3, 12)] if carousel_cfg.get("autoplay", True) else list(unique.values()),
            }

        fallback = await self._fallback_from_featured_shops()
        fallback.update(base)
        if not fallback.get("items"):
            fallback["empty_state"] = {
                "code": "no_sponsored_banners",
                "title": "Reklama bannerlari yo'q",
                "message": "Do'konlar CRM → Kontent markazi → Banners bo'limidan joylashtiradi.",
            }
        if not carousel_cfg.get("enabled", True):
            fallback["items"] = []
            fallback["slides"] = []
            fallback["source"] = "disabled"
        return fallback

    async def _fallback_from_featured_shops(self) -> dict[str, Any]:
        shops = await self._marketplace.list_featured_shops(limit=8)
        if not shops:
            return {"source": "empty", "rotation_interval_ms": 4500, "items": [], "slides": []}

        tiers = ["gold", "silver", "bronze", "bronze"]
        slides: list[dict[str, Any]] = []
        for idx, shop in enumerate(shops):
            code = tiers[idx % len(tiers)]
            weight = {"gold": 3, "silver": 2, "bronze": 1}[code]
            image = shop.logo_url or "/brand/bozorliii-product-placeholder.svg"
            base = {
                "id": f"fallback-{shop.id}",
                "shop_id": str(shop.id),
                "shop_name": shop.name,
                "shop_slug": shop.slug,
                "rating": round(float(shop.rating or 4.5), 1),
                "image_url": image,
                "headline": f"{shop.name} — trend",
                "tariff_code": code,
                "tariff_label": code.capitalize(),
                "priority_weight": weight,
                "dwell_ms": 4500 + weight * 200,
                "frame_style": {"gold": "gold_neon", "silver": "silver_glow", "bronze": "standard"}[code],
                "badge_label": "VIP Gold" if code == "gold" else ("Silver" if code == "silver" else None),
                "cta_url": f"/shop/{shop.slug}",
                "ipadrom": getattr(shop, "market_zone", None) or "Ippodrom",
                "location_label": shop.section or shop.floor,
                "rotation_key": str(shop.id),
            }
            for _ in range(weight):
                slides.append(dict(base))

        gold = [s for s in slides if s["tariff_code"] == "gold"]
        other = [s for s in slides if s["tariff_code"] != "gold"]
        random.shuffle(other)
        slides = gold + other
        unique = {s["rotation_key"]: s for s in slides}
        return {
            "source": "fallback",
            "rotation_interval_ms": 4500,
            "items": list(unique.values()),
            "slides": slides,
        }

    async def record_impression(self, banner_id: UUID) -> None:
        if str(banner_id).startswith("fallback"):
            return
        await self._repo.increment_impression(banner_id)
        await self._session.commit()

    async def record_click(self, banner_id: UUID) -> None:
        if str(banner_id).startswith("fallback"):
            return
        await self._repo.increment_click(banner_id)
        await self._session.commit()
