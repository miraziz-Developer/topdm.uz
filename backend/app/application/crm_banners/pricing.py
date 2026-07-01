"""Bosh sahifa karusel banneri — psixologik kunlik paketlar (oylik obuna emas)."""
from __future__ import annotations

from decimal import Decimal

from app.application.crm_banners.service import COIN_UZS_RATE, uzs_to_coins

BANNER_DAY_OPTIONS: tuple[int, ...] = (1, 3, 7, 30)
BANNER_MIN_DAYS = 1
BANNER_MAX_DAYS = 30

BANNER_DAY_LABELS_UZ: dict[int, str] = {
    1: "1 kun",
    3: "3 kun",
    7: "1 hafta",
    30: "1 oy",
}

# Har keyingi paket oldingisiga ozgina qo'shiladi — uzoq muddat "arzon" tuyuladi.
_TIER_EXTRA_DAILY: dict[int, float] = {
    1: 1.00,
    3: 0.50,
    7: 0.65,
    30: 1.75,
}


def banner_day_label_uz(days: int) -> str:
    return BANNER_DAY_LABELS_UZ.get(days, f"{days} kun")


def _round_psych_price(amount: float) -> int:
    if amount >= 50_000:
        return max(5_000, int(round(amount / 5_000) * 5_000))
    if amount >= 10_000:
        return max(1_000, int(round(amount / 1_000) * 1_000))
    return max(1_000, int(round(amount / 500) * 500))


def _banner_tier_prices_uzs(daily: int) -> dict[int, int]:
    if daily <= 0:
        return {d: 0 for d in BANNER_DAY_OPTIONS}
    p1 = _round_psych_price(daily * _TIER_EXTRA_DAILY[1])
    p3 = _round_psych_price(p1 + daily * _TIER_EXTRA_DAILY[3])
    p7 = _round_psych_price(p3 + daily * _TIER_EXTRA_DAILY[7])
    p30 = _round_psych_price(p7 + daily * _TIER_EXTRA_DAILY[30])
    return {1: p1, 3: p3, 7: p7, 30: p30}


def normalize_banner_days(days: int, *, default: int = 7) -> int:
    d = int(days or default)
    if d in BANNER_DAY_OPTIONS:
        return d
    if d < BANNER_MIN_DAYS:
        return BANNER_MIN_DAYS
    if d > BANNER_MAX_DAYS:
        return BANNER_MAX_DAYS
    nearest = min(BANNER_DAY_OPTIONS, key=lambda opt: abs(opt - d))
    return nearest


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
    Psixologik zinapoya: 3 kun ≈ 1 kun + ozgina, 1 hafta ≈ 3 kun + ozgina, 1 oy ≈ 1 hafta + ozgina.
    """
    package_days = normalize_banner_days(days)
    daily = banner_price_per_day_uzs(tariff)
    prices = _banner_tier_prices_uzs(daily)
    amount_uzs = max(1, prices[package_days])
    coin_cost = uzs_to_coins(amount_uzs)
    return amount_uzs, coin_cost, package_days


def banner_tier_upsell_uzs(tariff, days: int) -> int | None:
    """Oldingi paketga nisbatan qancha qo'shimcha to'lash kerakligi (UI uchun)."""
    package_days = normalize_banner_days(days)
    if package_days == 1:
        return None
    daily = banner_price_per_day_uzs(tariff)
    prices = _banner_tier_prices_uzs(daily)
    prev_key = {3: 1, 7: 3, 30: 7}.get(package_days)
    if prev_key is None:
        return None
    return max(0, prices[package_days] - prices[prev_key])


def tariff_public_dict(tariff) -> dict:
    ref_days = banner_reference_days(tariff)
    ref_price = banner_reference_price_uzs(tariff)
    per_day = banner_price_per_day_uzs(tariff)
    tier_prices = _banner_tier_prices_uzs(per_day)
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
        "day_labels": {str(d): banner_day_label_uz(d) for d in BANNER_DAY_OPTIONS},
        "tier_prices_uzs": {str(d): tier_prices[d] for d in BANNER_DAY_OPTIONS},
        "placement": "bozorliii.uz bosh sahifasidagi premium karusel",
    }


def quote_banner(tariff, days: int) -> dict:
    amount_uzs, coin_cost, package_days = banner_price_for_days(tariff, days)
    daily = banner_price_per_day_uzs(tariff)
    linear_uzs = max(1, daily * package_days)
    return {
        "tariff_code": tariff.code,
        "days": package_days,
        "day_label": banner_day_label_uz(package_days),
        "amount_uzs": amount_uzs,
        "price_per_day_uzs": banner_price_per_day_uzs(tariff),
        "effective_per_day_uzs": max(1, round(amount_uzs / package_days)),
        "upsell_delta_uzs": banner_tier_upsell_uzs(tariff, package_days),
        "savings_vs_linear_uzs": max(0, linear_uzs - amount_uzs),
        "coin_cost": coin_cost,
    }
