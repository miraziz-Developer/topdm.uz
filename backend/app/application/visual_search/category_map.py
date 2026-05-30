"""Uniform category slugs for visual search (UI label → DB slot keywords)."""

from __future__ import annotations

# Canonical slot keys used by slot_metadata._SLOT_RULES
CANONICAL_SLOTS = frozenset(
    {
        "shoes",
        "jacket",
        "pants",
        "shirt",
        "dress",
        "belt",
        "bag",
        "top",
        "outerwear",
        "accessory",
    }
)

# Uzbek / English UI labels → canonical slot
LABEL_TO_SLOT: dict[str, str] = {
    "bot": "shoes",
    "oyoq kiyim": "shoes",
    "poyabzal": "shoes",
    "krossovka": "shoes",
    "tufli": "shoes",
    "shoes": "shoes",
    "kurtka": "jacket",
    "palto": "jacket",
    "jacket": "jacket",
    "outerwear": "jacket",
    "svitch": "top",
    "sviter": "top",
    "sport majmua": "top",
    "sport kostyum": "top",
    "futbolka": "top",
    "polo": "top",
    "ko'ylak": "shirt",
    "koylak": "shirt",
    "shirt": "shirt",
    "top": "top",
    "shim": "pants",
    "jinsi": "pants",
    "pants": "pants",
    "yubka": "dress",
    "libos": "dress",
    "platye": "dress",
    "dress": "dress",
    "ayollar kechki libos": "dress",
    "ayollar kechki libos (platye)": "dress",
    "kechki libos": "dress",
    "kamar": "belt",
    "belbog": "belt",
    "sumka": "bag",
    "yuqori kiyim": "top",
    "shim / bel": "pants",
}

# Model category strings → canonical slot
RAW_CATEGORY_TO_SLOT: dict[str, str] = {
    "jacket": "jacket",
    "coat": "jacket",
    "outerwear": "jacket",
    "pants": "pants",
    "trousers": "pants",
    "shirt": "shirt",
    "top": "top",
    "sweater": "top",
    "hoodie": "top",
    "shoes": "shoes",
    "sneakers": "shoes",
    "dress": "dress",
    "belt": "belt",
    "bag": "bag",
}


def normalize_visual_category(*, label_uz: str = "", category: str = "") -> str:
    """
    Map localized detector output to a canonical slot slug for SQL + vector filters.
    """
    label_key = (label_uz or "").strip().lower()
    if label_key in LABEL_TO_SLOT:
        return LABEL_TO_SLOT[label_key]

    for phrase, slot in LABEL_TO_SLOT.items():
        if len(phrase) >= 4 and phrase in label_key:
            return slot

    cat_key = (category or "").strip().lower()
    if cat_key in RAW_CATEGORY_TO_SLOT:
        return RAW_CATEGORY_TO_SLOT[cat_key]
    if cat_key in LABEL_TO_SLOT:
        return LABEL_TO_SLOT[cat_key]

    # Avoid passing raw Uzbek label as SQL category (e.g. "Svitch" → no matches)
    if cat_key in CANONICAL_SLOTS:
        return cat_key

    return "top" if any(t in label_key for t in ("svit", "futbol", "polo", "ko'yl", "koyl")) else (
        "shoes"
        if any(t in label_key for t in ("bot", "oyoq", "krossovka", "tufli"))
        else "jacket"
        if any(t in label_key for t in ("kurtka", "palto", "blazer"))
        else "pants"
        if any(t in label_key for t in ("shim", "jinsi"))
        else "dress"
        if any(t in label_key for t in ("libos", "platye", "yubka", "kechki"))
        else "top"
    )
