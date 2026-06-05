from __future__ import annotations

import math

from app.core.config import Settings
from app.schemas.premium_market import PriceBreakdown


def round_up_uzs(amount: float, step: int = 1000) -> int:
    step = max(1, int(step))
    return int(math.ceil(max(0.0, amount) / step) * step)


def calculate_china_total(
    settings: Settings,
    *,
    base_price_cny: float,
    weight_kg: float,
) -> PriceBreakdown:
    cny_rate = float(settings.premium_cny_to_uzs_rate)
    usd_uzs = int(settings.usd_to_uzs_rate)
    margin_mult = float(settings.premium_margin_multiplier)
    margin_pct = float(settings.premium_margin_pct)
    cargo_usd_kg = float(settings.premium_cargo_rate_usd_per_kg)
    round_step = int(settings.premium_price_round_uzs)

    base_uzs = base_price_cny * cny_rate
    with_margin = base_uzs * margin_mult
    margin_amount = max(0, with_margin - base_uzs)
    cargo_uzs = max(0.0, weight_kg) * cargo_usd_kg * usd_uzs
    subtotal = with_margin + cargo_uzs
    total = round_up_uzs(subtotal, round_step)

    return PriceBreakdown(
        base_price_cny=round(base_price_cny, 2),
        cny_to_uzs_rate=cny_rate,
        base_price_uzs=int(round(base_uzs)),
        margin_pct=margin_pct,
        margin_amount_uzs=int(round(margin_amount)),
        weight_kg=round(max(0.0, weight_kg), 3),
        cargo_rate_usd_per_kg=cargo_usd_kg,
        usd_to_uzs_rate=usd_uzs,
        cargo_uzs=int(round(cargo_uzs)),
        subtotal_before_round_uzs=int(round(subtotal)),
        round_step_uzs=round_step,
        total_price_uzs=total,
    )


def calculate_local_total(
    settings: Settings,
    *,
    product_price_uzs: int,
    courier_fee_uzs: int | None = None,
) -> tuple[int, int, PriceBreakdown]:
    courier = courier_fee_uzs if courier_fee_uzs is not None else int(settings.premium_local_courier_base_uzs)
    round_step = int(settings.premium_price_round_uzs)
    subtotal = max(0, int(product_price_uzs)) + max(0, courier)
    total = round_up_uzs(subtotal, round_step)

    pricing = PriceBreakdown(
        base_price_cny=0,
        cny_to_uzs_rate=0,
        base_price_uzs=max(0, int(product_price_uzs)),
        margin_pct=0,
        margin_amount_uzs=0,
        weight_kg=0,
        cargo_rate_usd_per_kg=0,
        usd_to_uzs_rate=int(settings.usd_to_uzs_rate),
        cargo_uzs=courier,
        subtotal_before_round_uzs=subtotal,
        round_step_uzs=round_step,
        total_price_uzs=total,
    )
    return courier, total, pricing
