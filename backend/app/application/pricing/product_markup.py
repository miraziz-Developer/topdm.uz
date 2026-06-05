"""Mahsulot narxi: do'konchi bazasi + platforma ustamasi (mijozga ko'rinadigan narx)."""
from __future__ import annotations

from decimal import Decimal, ROUND_CEILING

from app.core.config import Settings, get_settings

UZS_QUANT = Decimal("0.01")


def _pct(settings: Settings | None) -> Decimal:
    cfg = settings or get_settings()
    return Decimal(str(cfg.platform_product_markup_pct))


def merchant_base_uzs(amount: int | Decimal, settings: Settings | None = None) -> int:
    """DB dagi `products.price` — do'kon egasi kiritgan bazaviy narx."""
    return max(0, int(amount))


def customer_sale_price_uzs(merchant_base: int, settings: Settings | None = None) -> int:
    """Mijoz ko'radigan narx = baza + ustama % (butun so'm, yuqoriga yaxlitlash)."""
    base = Decimal(int(merchant_base))
    if base <= 0:
        return 0
    rate = _pct(settings)
    multiplier = Decimal("1") + (rate / Decimal("100"))
    sale = (base * multiplier).quantize(Decimal("1"), rounding=ROUND_CEILING)
    return int(sale)


def platform_markup_uzs(merchant_base: int, settings: Settings | None = None) -> int:
    return customer_sale_price_uzs(merchant_base, settings) - merchant_base_uzs(merchant_base)


def order_line_totals(
    merchant_base_unit_uzs: int,
    quantity: int,
    settings: Settings | None = None,
) -> tuple[int, int, int]:
    """(merchant_subtotal, customer_subtotal, platform_markup)"""
    qty = max(1, int(quantity))
    base_unit = merchant_base_uzs(merchant_base_unit_uzs, settings)
    sale_unit = customer_sale_price_uzs(base_unit, settings)
    merchant_sub = base_unit * qty
    customer_sub = sale_unit * qty
    return merchant_sub, customer_sub, customer_sub - merchant_sub
