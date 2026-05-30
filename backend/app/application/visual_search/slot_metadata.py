"""Strict slot → SQL metadata boundaries for visual outfit search (no cross-category leak)."""

from __future__ import annotations

from typing import Any

from app.application.visual_search.category_map import normalize_visual_category
from app.application.visual_search.color_map import color_search_terms, normalize_color_uz

# slot_key → strict DB-facing rules
_SLOT_RULES: dict[str, dict[str, Any]] = {
    "belt": {
        "keywords": ("kamar", "belbog", "belt"),
        "exclude_name": (
            "ayol",
            "ayollar",
            "qiz",
            "kelin",
            "bolalar",
            "ko'ylak",
            "dress",
            "bluzka",
            "mato",
            "to'qimachilik",
            "ko'rpa",
            "pardabop",
            "rulon",
            "tufli",
            "krossovka",
            "poyabzal",
            "shim",
            "kurtka",
            "atir",
            "parfyum",
        ),
    },
    "kamar": {
        "keywords": ("kamar", "belbog", "belt"),
        "exclude_name": (
            "ayol",
            "ayollar",
            "qiz",
            "kelin",
            "bolalar",
            "ko'ylak",
            "dress",
            "mato",
            "to'qimachilik",
            "ko'rpa",
            "pardabop",
            "tufli",
            "krossovka",
            "poyabzal",
            "shim",
            "kurtka",
        ),
    },
    "pants": {
        "keywords": ("shim", "jinsi", "chino", "pant", "trouser", "pantalon"),
        "exclude_name": (
            "ko'ylak",
            "dress",
            "bluzka",
            "yubka",
            "skirt",
            "soat",
            "watch",
            "qo'l soat",
            "smart",
            "atir",
            "parfyum",
            "tufli",
            "krossovka",
            "poyabzal",
            "mato",
            "ko'rpa",
        ),
    },
    "shim": {
        "keywords": ("shim", "jinsi", "chino", "pant"),
        "exclude_name": (
            "ko'ylak",
            "dress",
            "bluzka",
            "yubka",
            "soat",
            "watch",
            "tufli",
            "krossovka",
            "poyabzal",
            "mato",
            "ko'rpa",
        ),
    },
    "jacket": {
        "keywords": ("kurtka", "jacket", "palto", "blazer", "kostyum"),
        "exclude_name": ("yubka", "skirt", "poyabzal", "tufli", "krossovka"),
    },
    "kurtka": {
        "keywords": ("kurtka", "jacket", "palto", "blazer"),
        "exclude_name": ("yubka", "shim", "poyabzal"),
    },
    "shirt": {
        "keywords": ("ko'ylak", "shirt", "futbolka", "polo", "koylak"),
        "exclude_name": ("shim", "yubka", "poyabzal"),
    },
    "shoes": {
        "keywords": ("poyabzal", "krossovka", "tufli", "shoes", "sandal", "bot", "oyoq kiyim"),
        "exclude_name": ("kurtka", "shim", "ko'ylak", "mato", "ko'rpa", "kamar", "belbog", "bolalar"),
    },
    "dress": {
        "keywords": ("ko'ylak", "dress", "libos", "sarpo", "platye", "kechki"),
        "exclude_name": ("erkak", "jinsi shim", "kamar"),
    },
    "top": {
        "keywords": (
            "sviter",
            "svit",
            "futbolka",
            "polo",
            "xudi",
            "hoodie",
            "ko'ylak",
            "koylak",
            "sport",
            "majmua",
            "kostyum",
            "trek",
        ),
        "exclude_name": ("yubka", "poyabzal", "tufli", "atir", "kosmetika"),
    },
    "outerwear": {
        "keywords": ("kurtka", "jacket", "palto", "blazer", "kostyum"),
        "exclude_name": ("yubka", "poyabzal", "shim"),
    },
    "bag": {
        "keywords": ("sumka", "bag", "ryukzak", "chelak"),
        "exclude_name": ("shim", "ko'ylak"),
    },
}

_SLOT_ALIASES: dict[str, str] = {
    "outerwear": "jacket",
    "top": "top",
}


def _normalize_slot_key(category: str, label_uz: str) -> str | None:
    canonical = normalize_visual_category(label_uz=label_uz, category=category)
    if canonical in _SLOT_RULES:
        return canonical
    mapped = _SLOT_ALIASES.get(canonical)
    if mapped and mapped in _SLOT_RULES:
        return mapped
    blob = f"{category} {label_uz}".lower()
    for key in _SLOT_RULES:
        if key in blob:
            return key
    return canonical if canonical in _SLOT_RULES else mapped


def infer_gender(text: str, vision: dict[str, Any] | None = None) -> str | None:
    blob = (text or "").lower()
    if vision and isinstance(vision.get("gender"), str):
        g = vision["gender"].lower()
        if g in ("male", "erkak", "m"):
            return "erkak"
        if g in ("female", "ayol", "f"):
            return "ayol"
    if any(t in blob for t in ("erkak", "erkaklar", "male", "муж", "мужской")):
        return "erkak"
    if any(t in blob for t in ("ayol", "ayollar", "female", "qiz", "жен", "женский")):
        return "ayol"
    return None


def build_strict_slot_filters(
    *,
    det: dict[str, Any],
    vision: dict[str, Any] | None = None,
    intent_text: str | None = None,
    photo_mode: bool = False,
) -> dict[str, Any]:
    """Hard metadata for hybrid / vector search — strict_slot=True enforces boundaries."""
    label_uz = str(det.get("label_uz") or "").strip()
    raw_category = str(det.get("category") or "").strip()
    category = normalize_visual_category(label_uz=label_uz, category=raw_category)
    search_text = str(det.get("search_query") or "").strip()
    slot_key = _normalize_slot_key(category, label_uz)

    gender = None if photo_mode else infer_gender(f"{intent_text or ''} {search_text}", vision)

    raw_color = det.get("color") or (vision or {}).get("color")
    canon_color = normalize_color_uz(str(raw_color) if raw_color else None)

    filters: dict[str, Any] = {
        "text": search_text or label_uz or category or "kiyim",
        "strict_slot": True,
        "color": canon_color,
        "color_terms": color_search_terms(canon_color),
        "material": det.get("material") or (vision or {}).get("material"),
    }

    if slot_key and slot_key in _SLOT_RULES:
        rule = _SLOT_RULES[slot_key]
        filters["slot_category_keywords"] = list(rule["keywords"])
        filters["exclude_name_patterns"] = list(rule.get("exclude_name") or ())
        filters["slot_key"] = slot_key
    elif category and category.lower() not in {"kiyim", "unknown", "outfit", "clothing"}:
        filters["slot_category_keywords"] = [category.lower(), label_uz.lower()] if label_uz else [category.lower()]
        filters["slot_key"] = category.lower()

    if gender == "erkak":
        filters["gender"] = "erkak"
        filters.setdefault("exclude_name_patterns", [])
        filters["exclude_name_patterns"] = list(
            set([*filters["exclude_name_patterns"], "ayol", "ayollar", "qiz", "kelin", "bolalar", "yubka"])
        )
    elif gender == "ayol":
        filters["gender"] = "ayol"
        filters.setdefault("exclude_name_patterns", [])
        filters["exclude_name_patterns"] = list(
            set([*filters["exclude_name_patterns"], "erkak", "erkaklar", "jinsi erkak"])
        )

    return filters
