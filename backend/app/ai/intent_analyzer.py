"""Stylist intent — budget (multi-currency), vibe tags, pagination signals."""

from __future__ import annotations

import re
from typing import Any

from app.core.config import get_settings

_PAGINATION_TRIGGERS = (
    "yana ko'rsat",
    "yana korsat",
    "yana ber",
    "yana bo'lsa",
    "yana variant",
    "boshqa variant",
    "boshqa rangini",
    "boshqa rang",
    "yoqmadi",
    "boshqasini",
    "ko'proq variant",
    "keyingi",
    "next",
    "show more",
    "boshqasi bormi",
    "boshqa taklif",
)

_WARDROBE_TRIGGERS = (
    "look",
    "komplekt",
    "kombin",
    "kiyinish",
    "yig'ib ber",
    "mosla",
    "uchrashuv",
    "polo",
    "klassik",
    "quiet luxury",
    "streetwear",
)

_VIBE_MAP: dict[str, tuple[str, ...]] = {
    "uchrashuv": ("uchrashuv", "date", "birinchi uchrashuv", "romantik"),
    "ish": ("ishga", "ofis", "meeting", "business"),
    "universitet": ("universitet", "talaba", "kampus"),
    "klassik": ("klassik", "classic", "elegant", "formal"),
    "polo": ("polo", "rugby shirt"),
    "quiet luxury": ("quiet luxury", "minimalist", "premium", "qimmat ko'rinish"),
    "streetwear": ("street", "oversize", "hoodie", "sneaker"),
}

_USD_RE = re.compile(
    r"(?P<amount>\d+(?:[.,]\d{1,2})?)\s*(?:\$|usd|dollar|dollars|aqsh\s*dollari)",
    re.IGNORECASE,
)
_EUR_RE = re.compile(r"(?P<amount>\d+(?:[.,]\d{1,2})?)\s*(?:€|eur|euro)", re.IGNORECASE)


def _amount_to_float(raw: str) -> float | None:
    cleaned = raw.replace(",", ".").strip()
    try:
        v = float(cleaned)
        return v if v > 0 else None
    except ValueError:
        return None


def parse_budget_with_fx(text: str) -> tuple[int | None, int | None, str | None]:
    """Return (min_uzs, max_uzs, budget_currency_note)."""
    from app.application.agents.bozor_chat_catalog import parse_budget_from_text

    settings = get_settings()
    usd_rate = int(getattr(settings, "usd_to_uzs_rate", 13_000) or 13_000)
    eur_rate = int(getattr(settings, "eur_to_uzs_rate", 14_000) or 14_000)
    lowered = (text or "").lower()
    max_uzs: int | None = None
    note: str | None = None

    usd = _USD_RE.search(text or "")
    if usd:
        amt = _amount_to_float(usd.group("amount"))
        if amt:
            max_uzs = int(amt * usd_rate)
            note = f"${amt:g} ≈ {max_uzs:,} UZS".replace(",", " ")

    if max_uzs is None:
        eur = _EUR_RE.search(text or "")
        if eur:
            amt = _amount_to_float(eur.group("amount"))
            if amt:
                max_uzs = int(amt * eur_rate)
                note = f"€{amt:g} ≈ {max_uzs:,} UZS".replace(",", " ")

    min_uzs, max_local = parse_budget_from_text(text)
    if max_local is not None:
        max_uzs = max_local
    return min_uzs, max_uzs, note


def extract_vibe_tags(text: str) -> list[str]:
    lowered = (text or "").lower()
    tags: list[str] = []
    for label, keywords in _VIBE_MAP.items():
        if any(k in lowered for k in keywords):
            tags.append(label.title() if label != "quiet luxury" else "Quiet Luxury")
    if "polo" in lowered and "Polo" not in tags:
        tags.append("Polo")
    if any(k in lowered for k in ("shim", "chino", "trouser", "pant")):
        tags.append("Klassik shim")
    if any(k in lowered for k in ("ko'ylak", "shirt", "kurtka")) and "Shirt" not in tags:
        tags.append("Shirt")
    return list(dict.fromkeys(tags))[:8]


def is_pagination_request(text: str) -> bool:
    lowered = (text or "").lower()
    return any(t in lowered for t in _PAGINATION_TRIGGERS)


def is_wardrobe_request(text: str) -> bool:
    lowered = (text or "").lower()
    if is_pagination_request(text):
        return True
    return any(t in lowered for t in _WARDROBE_TRIGGERS) or len(extract_vibe_tags(text)) >= 2


def analyze_stylist_intent(text: str) -> dict[str, Any]:
    min_p, max_p, fx_note = parse_budget_with_fx(text)
    vibes = extract_vibe_tags(text)
    paginate = is_pagination_request(text)
    wardrobe = is_wardrobe_request(text)
    occasion = None
    for key in ("uchrashuv", "universitet", "ish"):
        if key in (text or "").lower():
            occasion = key
            break
    top_share = 0.4
    bottom_share = 0.5
    return {
        "min_price": min_p,
        "max_price": max_p,
        "budget_fx_note": fx_note,
        "vibe_tags": vibes,
        "occasion": occasion,
        "is_pagination": paginate,
        "is_wardrobe_request": wardrobe,
        "budget_split": {"ustki": top_share, "pastki": bottom_share},
        "raw_query": (text or "").strip(),
    }
