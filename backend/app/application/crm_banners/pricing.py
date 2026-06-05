"""Bosh sahifa karusel banneri — kun bo'yicha narx (oylik obuna emas)."""
from __future__ import annotations

from decimal import Decimal

from app.application.crm_banners.service import COIN_UZS_RATE, uzs_to_coins

BANNER_DAY_OPTIONS: tuple[int, ...] = (7, 14, 30, 60, 90)
BANNER_MIN_DAYS = 7
BANNER_MAX_DAYS = 90


def normalize_banner_days(days: int, *, default: int = 30) -> int:
    d = int(days or default)
    if d in BANNER_DAY_OPTIONS:
        return d
    if d < BANNER_MIN_DAYS:
        return BANNER_MIN_DAYS
    if d > BANNER_MAX_DAYS:
        return BANNER_MAX_DAYS
    return d


def banner_reference_days(tariff) -> int:
    return max(1, int(getattr(tariff, "duration_days", None) or 30))


def banner_reference_price_uzs(tariff) -> int:
    monthly = getattr(tariff, "price_uzs_monthly", None)
    if monthly is not None:
        return max(0, int(Decimal(str(monthly))))
    from app.application.billing.plans import ALL_BANNER_TARIFFS

    static = next((t for t in ALL_BANNER_TARIFFS if t.code == getattr(tariff, "code", "")), None)
    return int(static.price_uzs) if static else 0


def banner_price_per_day_uzs(tariff) -> int:
    ref_days = banner_reference_days(tariff)
    ref_price = banner_reference_price_uzs(tariff)
    if ref_price <= 0:
        return 0
    return max(1, round(ref_price / ref_days))


def banner_price_for_days(tariff, days: int) -> tuple[int, int, int]:
    """
    (amount_uzs, coin_cost, package_days)
    Narx = (30 kunlik bazaviy narx / 30) × tanlangan kun — oylik obuna emas.
    """
    package_days = normalize_banner_days(days)
    ref_days = banner_reference_days(tariff)
    ref_price = banner_reference_price_uzs(tariff)
    amount_uzs = max(1, round(ref_price * package_days / ref_days))
    coin_cost = uzs_to_coins(amount_uzs)
    return amount_uzs, coin_cost, package_days


def tariff_public_dict(tariff) -> dict:
    ref_days = banner_reference_days(tariff)
    ref_price = banner_reference_price_uzs(tariff)
    per_day = banner_price_per_day_uzs(tariff)
    priority = int(getattr(tariff, "priority_weight", None) or 1)
    return {
        "code": tariff.code,
        "name_uz": tariff.name_uz,
        "name_ru": getattr(tariff, "name_ru", None),
        "priority_weight": priority,
        "carousel_slot": priority,
        "dwell_ms": int(getattr(tariff, "dwell_ms", None) or 4500),
        "reference_days": ref_days,
        "reference_price_uzs": ref_price,
        "price_per_day_uzs": per_day,
        "duration_days": ref_days,
        "badge_label": getattr(tariff, "badge_label", None),
        "frame_style": getattr(tariff, "frame_style", None),
        "price_uzs": ref_price,
        "day_options": list(BANNER_DAY_OPTIONS),
        "placement": "bozorliii.uz bosh sahifasidagi premium karusel",
    }


def quote_banner(tariff, days: int) -> dict:
    amount_uzs, coin_cost, package_days = banner_price_for_days(tariff, days)
    return {
        "tariff_code": tariff.code,
        "days": package_days,
        "amount_uzs": amount_uzs,
        "price_per_day_uzs": banner_price_per_day_uzs(tariff),
    }
