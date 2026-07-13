"""AI vision atributlaridan DB kategoriyasini avtomatik tanlash."""

from __future__ import annotations

import re
import uuid
from typing import TYPE_CHECKING, Any

from app.application.merchant.category_size_presets import normalize_category_hint

_GENERIC_PRODUCT_NAMES = frozenset({
    "",
    "yangi mahsulot",
    "boshqa",
    "other",
    "mahsulot",
    "yangi tovar",
})

_HINT_PRODUCT_NAMES: dict[str, str] = {
    "poyabzal": "Oyoq kiyim",
    "shim": "Shim",
    "koylak": "Ko'ylak",
    "kurtka": "Kurtka",
    "libos": "Libos",
    "sumka": "Sumka",
    "sport": "Sport kiyim",
    "futbolka": "Futbolka",
    "bolalar": "Bolalar kiyimi",
    "mato": "Mato",
    "atir": "Atir",
    "texnika": "Texnika",
    "idish": "Idish",
    "oziq": "Oziq-ovqat",
}


def is_generic_product_name(name: str | None) -> bool:
    return str(name or "").strip().casefold() in _GENERIC_PRODUCT_NAMES


def refine_product_name_from_category(attrs: dict[str, Any]) -> dict[str, Any]:
    """Kategoriya tanlangan, lekin nom «Boshqa»/bo'sh bo'lsa — sub-kategoriyadan nom chiqaradi."""
    if not is_generic_product_name(attrs.get("product_name")):
        return attrs

    out = dict(attrs)
    label = str(out.get("category_label") or "").strip()
    if label:
        parsed = parse_category_label(label)
        if parsed:
            sub = parsed[1].strip()
            if sub and not is_generic_product_name(sub):
                out["product_name"] = sub
                return out

    hint = normalize_category_hint(str(out.get("category_hint") or ""))
    if hint and hint != "boshqa":
        mapped = _HINT_PRODUCT_NAMES.get(hint)
        if mapped:
            out["product_name"] = mapped
    return out

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.infrastructure.db.models import CategoryModel
    from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository

# category_hint → (root nomi, sub nomi) audience bo'yicha
_HINT_ROUTES: dict[str, dict[str, tuple[str, str]]] = {
    "shim": {
        "erkak": ("Erkaklar kiyimi", "Shim va jinsi"),
        "ayol": ("Ayollar kiyimi", "Shim va jinsi"),
        "bolalar": ("Bolalar kiyimi", "Bolalar shim va futbolka"),
    },
    "poyabzal": {
        "erkak": ("Poyabzal", "Erkaklar poyabzali"),
        "ayol": ("Poyabzal", "Ayollar poyabzali"),
        "bolalar": ("Poyabzal", "Bolalar poyabzali"),
    },
    "kurtka": {
        "erkak": ("Erkaklar kiyimi", "Kurtka va jilet"),
        "ayol": ("Ayollar kiyimi", "Kurtka va palto"),
        "bolalar": ("Bolalar kiyimi", "Sport kiyim"),
    },
    "koylak": {
        "erkak": ("Erkaklar kiyimi", "Ko'ylak (rubashka)"),
        "ayol": ("Ayollar kiyimi", "Ko'ylak va bluzka"),
        "bolalar": ("Bolalar kiyimi", "Kundalik kiyim"),
    },
    "libos": {
        "erkak": ("Erkaklar kiyimi", "Kostyum va klassik"),
        "ayol": ("Ayollar kiyimi", "Libos va to'y libosi"),
        "bolalar": ("Bolalar kiyimi", "Kundalik kiyim"),
    },
    "sumka": {
        "erkak": ("Aksessuarlar", "Sumka"),
        "ayol": ("Aksessuarlar", "Sumka"),
        "bolalar": ("Aksessuarlar", "Sumka"),
    },
    "sport": {
        "erkak": ("Erkaklar kiyimi", "Sport kiyim"),
        "ayol": ("Ayollar kiyimi", "Sport kiyim"),
        "bolalar": ("Bolalar kiyimi", "Sport kiyim"),
    },
    "bolalar": {
        "erkak": ("Bolalar kiyimi", "Kundalik kiyim"),
        "ayol": ("Bolalar kiyimi", "Kundalik kiyim"),
        "bolalar": ("Bolalar kiyimi", "Kundalik kiyim"),
    },
}


def infer_hint_from_attrs(attrs: dict[str, Any]) -> str | None:
    """product_name / description dan category_hint chiqarish."""
    hint = normalize_category_hint(str(attrs.get("category_hint") or attrs.get("category") or ""))
    if hint and hint not in {"", "boshqa"}:
        return hint
    text = " ".join(str(attrs.get(key) or "") for key in ("product_name", "description")).casefold()
    if not text.strip():
        return None
    tokens = (
        ("poyabzal", ("poyabzal", "krossovka", "tufli", "shippak", "sandal", "mokasen", "baletka")),
        ("shim", ("shim", "jinsi", "short")),
        ("kurtka", ("kurtka", "palto", "jilet")),
        ("koylak", ("ko'ylak", "koylak", "rubashka", "futbolka", "mayka", "bluzka")),
        ("libos", ("libos", "to'y", "kostyum")),
        ("sumka", ("sumka", "ryukzak")),
        ("sport", ("sport",)),
        ("bolalar", ("bolalar", "chaqaloq", "maktab formasi")),
        ("mato", ("mato", "gazmol", "atlas", "pardabop", "tekstil")),
        ("atir", ("atir", "parfyum", "parfum")),
        ("texnika", ("telefon", "smartfon", "mikser", "muzlatgich", "noutbuk")),
        ("idish", ("idish", "tovoq", "choynak", "piyola")),
        ("oziq", ("yong'oq", "ziravor", "bodom", "shirinlik")),
    )
    for mapped, words in tokens:
        if any(word in text for word in words):
            return mapped
    return None


def infer_audience(*parts: str | None) -> str:
    text = " ".join(p for p in parts if p and str(p).strip()).casefold()
    if not text.strip():
        return "erkak"
    if any(token in text for token in ("bolalar", "bola ", "chaqaloq", "maktab formasi", "bolalar ")):
        return "bolalar"
    if any(token in text for token in ("ayollar", "ayol ", "qizlar", "qiz ", "ayollar ")):
        return "ayol"
    if any(token in text for token in ("erkaklar", "erkak ", "erkaklar ")):
        return "erkak"
    return "erkak"


def infer_audience_from_attrs(attrs: dict) -> str:
    """attrs ichidagi audience, product_name, description, category_hint dan audience aniqlash."""
    # AI to'g'ridan-to'g'ri audience bergan bo'lsa — ishlatamiz
    ai_audience = str(attrs.get("audience") or "").strip().lower()
    if ai_audience in {"erkak", "ayol", "bolalar"}:
        return ai_audience
    # Matndan aniqlash
    return infer_audience(
        str(attrs.get("product_name") or ""),
        str(attrs.get("description") or ""),
        str(attrs.get("category_hint") or ""),
        str(attrs.get("category_label") or ""),
    )


def parse_category_label(label: str) -> tuple[str, str] | None:
    raw = (label or "").strip()
    if not raw:
        return None
    parts = [p.strip() for p in re.split(r"[›>]", raw) if p.strip()]
    if len(parts) < 2:
        return None
    return parts[0], parts[-1]


def resolve_tree_names(attrs: dict[str, Any]) -> tuple[str, str] | None:
    inferred = infer_hint_from_attrs(attrs)
    hint = normalize_category_hint(inferred or str(attrs.get("category_hint") or attrs.get("category") or ""))
    text = " ".join(
        str(attrs.get(key) or "")
        for key in ("product_name", "description", "category_label", "category_hint", "category")
    )
    # AI audience bergan bo'lsa — uni ishlatamiz, aks holda matndan aniqlaymiz
    audience = infer_audience_from_attrs(attrs) if attrs.get("audience") else infer_audience(text, hint)
    if hint in _HINT_ROUTES:
        return _HINT_ROUTES[hint].get(audience) or _HINT_ROUTES[hint]["erkak"]

    parsed = parse_category_label(str(attrs.get("category_label") or ""))
    if parsed:
        return parsed

    # Matndan sub kategoriya nomini taxmin qilish
    lowered = text.casefold()
    keyword_map = (
        ("shim va jinsi", ("Erkaklar kiyimi", "Shim va jinsi")),
        ("jinsi", ("Erkaklar kiyimi", "Shim va jinsi")),
        ("shim", ("Erkaklar kiyimi", "Shim va jinsi")),
        ("krossovka", ("Poyabzal", "Krossovka")),
        ("tufli", ("Poyabzal", "Tufli va mokasen")),
        ("poyabzal", ("Poyabzal", "Erkaklar poyabzali")),
        ("sumka", ("Aksessuarlar", "Sumka")),
        ("kurtka", ("Erkaklar kiyimi", "Kurtka va jilet")),
        ("futbolka", ("Erkaklar kiyimi", "Futbolka va mayka")),
    )
    for token, route in keyword_map:
        if token in lowered:
            root, sub = route
            if audience == "ayol" and hint != "sport":
                if root == "Erkaklar kiyimi":
                    root = "Ayollar kiyimi"
                if sub == "Kurtka va jilet":
                    sub = "Kurtka va palto"
                if sub == "Erkaklar poyabzali":
                    sub = "Ayollar poyabzali"
            if audience == "bolalar":
                if root.startswith("Erkaklar") or root.startswith("Ayollar"):
                    root = "Bolalar kiyimi"
                    sub = "Kundalik kiyim"
            return root, sub
    return None


async def resolve_category_from_attrs(session: AsyncSession, attrs: dict[str, Any]) -> CategoryModel | None:
    from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository

    repo = MarketplaceRepository(session)

    cat_id = attrs.get("category_id")
    if cat_id:
        try:
            from app.infrastructure.db.models import CategoryModel

            row = await session.get(CategoryModel, uuid.UUID(str(cat_id)))
            if row:
                return row
        except (ValueError, TypeError):
            pass

    parsed = parse_category_label(str(attrs.get("category_label") or ""))
    if parsed:
        matched = await repo.get_category_by_parent_and_child_name(parsed[0], parsed[1])
        if matched:
            return matched

    tree = resolve_tree_names(attrs)
    if tree:
        matched = await repo.get_category_by_parent_and_child_name(tree[0], tree[1])
        if matched:
            return matched

    hint = str(attrs.get("category_hint") or attrs.get("category") or "").strip()
    if hint:
        matched = await repo.find_subcategory_by_hint(hint, audience=infer_audience(
            str(attrs.get("product_name") or ""),
            str(attrs.get("description") or ""),
            hint,
        ))
        if matched:
            return matched
        matched = await repo.get_category_by_slug_or_name(hint)
        if matched and matched.parent_id is not None:
            return matched

    return None


def category_label_for(cat: CategoryModel, *, parent: CategoryModel | None = None) -> str:
    if parent:
        return f"{parent.name} › {cat.name}"
    return cat.name


async def resolve_or_create_category(session: AsyncSession, attrs: dict[str, Any]):
    """Mavjud kategoriya yoki yangi (AI/qoida) yaratilgan sub-kategoriya."""
    from app.application.merchant.category_dynamic import resolve_category_names
    from app.application.merchant.category_seed_service import CategorySeedService
    from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository

    repo = MarketplaceRepository(session)
    await CategorySeedService(session).ensure_bazaar_catalog()

    working = dict(attrs)
    inferred = infer_hint_from_attrs(working)
    if inferred:
        working["category_hint"] = inferred

    cat = await resolve_category_from_attrs(session, working)
    if cat is not None:
        return cat

    names = await resolve_category_names(working)
    if not names:
        return None

    root_name, sub_name = names
    return await CategorySeedService(session).get_or_create_subcategory(root_name, sub_name)


async def enrich_attrs_with_category(session: AsyncSession, attrs: dict[str, Any]) -> dict[str, Any]:
    """category_id va category_label ni AI natijasidan to'ldiradi; kerak bo'lsa yangi kategoriya."""
    if attrs.get("category_id"):
        return attrs

    try:
        working = dict(attrs)
        cat = await resolve_or_create_category(session, working)
    except Exception:
        from loguru import logger

        logger.exception("enrich_attrs_with_category_failed")
        return attrs

    if cat is None:
        return attrs

    from app.infrastructure.db.models import CategoryModel

    parent: CategoryModel | None = None
    if cat.parent_id:
        parent = await session.get(CategoryModel, cat.parent_id)

    out = dict(working)
    out["category_id"] = str(cat.id)
    out["category_label"] = category_label_for(cat, parent=parent)
    out["category_auto"] = True
    out["category_created_dynamic"] = bool(out.get("suggested_root_category") or out.get("category_hint") == "boshqa")
    return refine_product_name_from_category(out)
