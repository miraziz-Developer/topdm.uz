"""Per-request locale & currency from frontend headers."""

from __future__ import annotations

from contextvars import ContextVar

from app.core.config import get_settings

_locale_ctx: ContextVar[str] = ContextVar("bozor_locale", default="uz")
_currency_ctx: ContextVar[str] = ContextVar("bozor_currency", default="UZS")


def set_client_context(*, locale: str | None, currency: str | None) -> None:
    loc = (locale or "uz").strip().lower()[:8] or "uz"
    cur = (currency or "UZS").strip().upper()[:8] or "UZS"
    if cur not in {"UZS", "USD", "KZT", "KGS", "TJS"}:
        cur = "UZS"
    _locale_ctx.set(loc)
    _currency_ctx.set(cur)


def get_locale() -> str:
    return _locale_ctx.get()


def get_currency() -> str:
    return _currency_ctx.get()


def uzs_to_display(amount_uzs: float, currency: str | None = None) -> tuple[float, str]:
    """Return (display_amount, currency_code). DB prices are always stored UZS."""
    cur = (currency or get_currency()).upper()
    settings = get_settings()
    if cur == "USD":
        rate = float(getattr(settings, "usd_to_uzs_rate", 13_000) or 13_000)
        return round(amount_uzs / rate, 2), "USD"
    if cur == "KZT":
        return round(amount_uzs / 25, 0), "KZT"
    if cur == "KGS":
        return round(amount_uzs / 140, 0), "KGS"
    if cur == "TJS":
        return round(amount_uzs / 1_200, 0), "TJS"
    return float(amount_uzs), "UZS"


def apply_currency_to_product_dict(product: dict, currency: str | None = None) -> dict:
    cur = (currency or get_currency()).upper()
    price_uzs = float(product.get("price") or 0)
    display, code = uzs_to_display(price_uzs, cur)
    out = {**product, "price_uzs": int(price_uzs), "currency": code, "price": display}
    return out


def apply_currency_to_items(items: list[dict], currency: str | None = None) -> list[dict]:
    return [apply_currency_to_product_dict(dict(i), currency) for i in items]
