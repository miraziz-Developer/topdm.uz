from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

SIZE_PRESET_GROUPS: dict[str, list[str]] = {
    "clothing": ["XS", "S", "M", "L", "XL", "XXL"],
    "shoes": ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"],
    "pants": ["28", "29", "30", "31", "32", "33", "34", "36", "38"],
    "kids": ["2Y", "4Y", "6Y", "8Y", "10Y", "12Y", "14Y"],
    "accessories": ["Bitta o'lcham", "S", "M", "L"],
    "default": ["S", "M", "L", "XL"],
}

SIZE_GROUP_LABELS: dict[str, str] = {
    "clothing": "Kiyim razmerlari",
    "shoes": "Poyabzal razmerlari (EU)",
    "pants": "Shim razmerlari (bel)",
    "kids": "Bolalar razmerlari",
    "accessories": "Aksessuar o'lchami",
    "default": "Razmerlar",
}

# Tartib muhim: poyabzal «kiyim» dan oldin tekshiriladi.
_GROUP_MATCHERS: list[tuple[str, tuple[str, ...]]] = [
    (
        "shoes",
        (
            "poyabzal",
            "oyoq kiyim",
            "oyoqkiyim",
            "krossovka",
            "krossovk",
            "tufli",
            "mokasen",
            "sandal",
            "shippak",
            "shippagi",
            "baletka",
            "kalish",
            "papuch",
            "slipper",
            "sneaker",
            "loafer",
            "shoes",
            "footwear",
            "poyabzali",
            "sandallar",
        ),
    ),
    ("pants", ("shim", "jinsi", "short", "belbog")),
    (
        "kids",
        (
            "bolalar kiyimi",
            "chaqaloq kiyimi",
            "maktab formasi",
            "bolalar shim",
            "kundalik kiyim",
        ),
    ),
    (
        "accessories",
        (
            "sumka",
            "aksessuar",
            "kamar",
            "galstuk",
            "sharf",
            "shapka",
            "zargarlik",
            "soat",
            "atir",
            "parfyum",
            "kosmetika",
        ),
    ),
    (
        "clothing",
        (
            "kiyim",
            "koylak",
            "ko'ylak",
            "kurtka",
            "futbolka",
            "mayka",
            "libos",
            "yubka",
            "bluzka",
            "palto",
            "jilet",
            "kostyum",
            "rubashka",
            "sport kiyim",
            "ichki kiyim",
            "haylov",
            "to'y libosi",
        ),
    ),
]


def normalize_category_hint(value: str | None) -> str:
    return (value or "").strip().casefold()


def size_group_for_context(*parts: str | None) -> str:
    combined = " ".join(p for p in parts if p and str(p).strip()).casefold()
    if not combined.strip():
        return "default"
    for group, tokens in _GROUP_MATCHERS:
        for token in tokens:
            if token in combined:
                return group
    if "bolalar" in combined:
        return "kids"
    return "default"


def size_group_for_hint(category_hint: str | None, *, category_name: str | None = None) -> str:
    return size_group_for_context(category_hint, category_name)


def size_presets_for_hint(category_hint: str | None, *, category_name: str | None = None) -> list[str]:
    group = size_group_for_hint(category_hint, category_name=category_name)
    return list(SIZE_PRESET_GROUPS.get(group, SIZE_PRESET_GROUPS["default"]))


def size_presets_for_context(*parts: str | None) -> list[str]:
    group = size_group_for_context(*parts)
    return list(SIZE_PRESET_GROUPS.get(group, SIZE_PRESET_GROUPS["default"]))


def size_group_label(group: str) -> str:
    return SIZE_GROUP_LABELS.get(group, SIZE_GROUP_LABELS["default"])


async def category_name_chain(session: AsyncSession, category_id: str) -> str:
    from app.infrastructure.db.models import CategoryModel

    try:
        cid = uuid.UUID(str(category_id))
    except (TypeError, ValueError):
        return ""
    parts: list[str] = []
    seen: set[uuid.UUID] = set()
    while cid and cid not in seen:
        seen.add(cid)
        cat = await session.get(CategoryModel, cid)
        if not cat:
            break
        parts.append(cat.name)
        cid = cat.parent_id
    return " ".join(reversed(parts))


async def size_presets_for_attrs(session: AsyncSession | None, attrs: dict) -> list[str]:
    cat_chain = ""
    if session is not None and attrs.get("category_id"):
        cat_chain = await category_name_chain(session, str(attrs["category_id"]))
    group = size_group_for_context(
        str(attrs.get("category_hint") or ""),
        str(attrs.get("category") or ""),
        str(attrs.get("category_label") or ""),
        cat_chain,
        str(attrs.get("product_name") or ""),
        str(attrs.get("description") or ""),
    )
    return list(SIZE_PRESET_GROUPS.get(group, SIZE_PRESET_GROUPS["default"]))


async def size_group_for_attrs(session: AsyncSession | None, attrs: dict) -> str:
    cat_chain = ""
    if session is not None and attrs.get("category_id"):
        cat_chain = await category_name_chain(session, str(attrs["category_id"]))
    return size_group_for_context(
        str(attrs.get("category_hint") or ""),
        str(attrs.get("category") or ""),
        str(attrs.get("category_label") or ""),
        cat_chain,
        str(attrs.get("product_name") or ""),
        str(attrs.get("description") or ""),
    )
