"""Uzbek / English color tokens for visual search (rasm → DB matn qidiruv)."""

from __future__ import annotations

from PIL import Image

# Canonical Uzbek label → search tokens (name, description, attributes.color)
COLOR_ALIASES: dict[str, tuple[str, ...]] = {
    "sariq": ("sariq", "yellow", "sari", "limon", "oltin"),
    "qora": ("qora", "black", "qoramtir", "to'q"),
    "oq": ("oq", "white", "ak", "krem", "krem"),
    "ko'k": ("ko'k", "kok", "blue", "moviy", "navy"),
    "qizil": ("qizil", "red", "qirmizi"),
    "yashil": ("yashil", "green", "zaytun"),
    "bej": ("bej", "beige", "krem", "sut"),
    "pushti": ("pushti", "pink", "rozoviy"),
    "kulrang": ("kulrang", "grey", "gray", "silver"),
    "jigarrang": ("jigarrang", "brown", "qahva"),
}

# English / hex hints from vision models
_RAW_TO_CANONICAL: dict[str, str] = {
    "yellow": "sariq",
    "sari": "sariq",
    "gold": "sariq",
    "black": "qora",
    "white": "oq",
    "blue": "ko'k",
    "red": "qizil",
    "green": "yashil",
    "beige": "bej",
    "pink": "pushti",
    "grey": "kulrang",
    "gray": "kulrang",
    "brown": "jigarrang",
}


def normalize_color_uz(raw: str | None) -> str | None:
    if not raw:
        return None
    key = str(raw).strip().lower().replace("#", "")
    if not key or key in {"unknown", "noma'lum", "nomalum"}:
        return None
    if key in COLOR_ALIASES:
        return key
    if key in _RAW_TO_CANONICAL:
        return _RAW_TO_CANONICAL[key]
    for canon, aliases in COLOR_ALIASES.items():
        if key == canon or key in aliases:
            return canon
    return key if len(key) >= 3 else None


def color_search_terms(raw: str | None) -> list[str]:
    canon = normalize_color_uz(raw)
    if not canon:
        return []
    return list(dict.fromkeys([canon, *COLOR_ALIASES.get(canon, ())]))


def _rgb_to_canonical_uz(r: int, g: int, b: int) -> str | None:
    """Map average RGB to marketplace color slug (no API)."""
    mx, mn = max(r, g, b), min(r, g, b)
    if mx < 42:
        return "qora"
    if mx > 215 and mn > 185:
        return "oq"
    if mx - mn < 28:
        return "kulrang" if mx < 175 else "oq"
    if b >= r and b >= g:
        if mx < 120:
            return "qora"
        return "ko'k"
    if r < 100 and g < 100 and b > 70:
        return "ko'k"
    if r >= g and r >= b:
        if g > 95 and b < 95:
            return "sariq"
        return "qizil"
    if g >= r and g >= b:
        return "yashil"
    if r > 70 and g > 45 and b < 75:
        return "jigarrang"
    if r > 120 and g > 90:
        return "bej"
    return "kulrang"


def color_uz_from_image(image: Image.Image) -> str | None:
    """Dominant color from a clothing crop (Taobao-style per-piece color)."""
    thumb = image.convert("RGB")
    thumb.thumbnail((64, 64))
    pixels = list(thumb.getdata())
    if not pixels:
        return None
    n = len(pixels)
    r = sum(p[0] for p in pixels) // n
    g = sum(p[1] for p in pixels) // n
    b = sum(p[2] for p in pixels) // n
    return _rgb_to_canonical_uz(r, g, b)


def color_ui_label(canon: str | None) -> str | None:
    """Frontend SmartFilters label (Sariq, Qora, …)."""
    if not canon:
        return None
    labels = {
        "sariq": "Sariq",
        "qora": "Qora",
        "oq": "Oq",
        "ko'k": "Ko'k",
        "qizil": "Qizil",
        "yashil": "Yashil",
        "bej": "Bej",
        "pushti": "Pushti",
    }
    return labels.get(canon, canon.capitalize())
