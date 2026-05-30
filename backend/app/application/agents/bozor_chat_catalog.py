"""Parse shopper intent and format live Postgres catalog hits for the Bozor-AI agent."""

from __future__ import annotations

import re
from typing import Any

# Terms the model must never invent unless the user said them.
BANNED_HALLUCINATION_TERMS = frozenset(
    {
        "maktab kechasi",
        "maktab formasi",
        "maktab",
        "kechasi",
        "uniforma",
        "iphone",
        "macbook",
        "samsung galaxy",
    }
)

CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "erkak": ("erkak", "erkaklar", "jinsi", "kostyum", "erkaklar uchun"),
    "ayol": ("ayol", "ayollar", "qiz", "ayollar uchun"),
    "bola": ("bola", "bolalar", "kids", "bolalar uchun"),
    "poyabzal": ("poyabzal", "krossovka", "oyoq", "sandal", "tufli"),
    "aksessuar": ("aksessuar", "sumka", "belbog", "shapka", "sharf"),
}

# Aniq buyum (mayka, tursik…) — chat va matn qidiruvda poyabzal aralashmasin.
GARMENT_SLOT_KEYWORDS: dict[str, tuple[str, ...]] = {
    "mayka": ("mayka", "maika", "futbolka", "fudbolka", "t-shirt", "tishirt", "triko", "nod"),
    "tursik": ("tursik", "trusik", "tishirt", "ichki kiyim", "underwear", "boxer", "kaltsa"),
    "ko'ylak": ("ko'ylak", "koylak", "shirt", "rubashka"),
    "shim": ("shim", "pant", "trouser", "jinsi shim"),
}

FOOTWEAR_TOKENS = ("poyabzal", "krossovka", "tufli", "sandal", "shoe", "boot", "sneaker", "oyoq kiyim")

ROOT_CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "Kiyim-kechak & Moda": ("kiyim", "moda", "ko'ylak", "libos", "kurtka", "sarpo", "kelin"),
    "Poyabzal": ("poyabzal", "krossovka", "tufli", "oyoq kiyim"),
    "Go'zallik & Parfümeriya": ("atir", "parfyum", "kosmetika", "go'zallik"),
    "Matolar & Tekstil": ("mato", "matolar", "tekstil", "gazmol", "pardabop"),
    "Aksessuarlar": ("aksessuar", "sumka", "belbog"),
    "Bolalar & Maktab": ("bolalar", "maktab", "forma"),
}

SUB_CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "Sarpo & Kechki liboslar": ("sarpo", "kelin", "kechki", "to'y"),
    "Sarpo gazmollari": ("gazmol", "sarpo mato"),
    "Pardabop matolar": ("pardabop", "mato"),
    "Dubay atirlari optom": ("dubay", "atir", "lattafa"),
}

MARKET_ZONE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "Abu Sahiy": ("abu sahiy", "abu saxiy", "abu sahi"),
    "Ippodrom": ("ippodrom", "chorsu", "toshkent yo'lagi"),
    "Kozgalovka": ("kozgalovka", "ulgurji", "optom bozor"),
}

BLOCK_SECTOR_KEYWORDS: dict[str, tuple[str, ...]] = {
    "Chorsu bloki": ("chorsu",),
    "Toshkent yo'lagi": ("toshkent yo'lagi", "toshkent yo'lak"),
    "1-Glavniy": ("1-glavniy", "glavniy"),
    "Yevropa bloki": ("yevropa",),
}

_UZS_RE = re.compile(
    r"(?P<amount>\d[\d\s]{2,12})\s*(?:so['']?m|sum|uzs|сум)?",
    re.IGNORECASE,
)
_BUDGET_RE = re.compile(
    r"(?P<amount>\d[\d\s]{2,12})\s*(?:so['']?m|sum)?\s*(?:gacha|dan|gacha|chegara|budget|byudjet)",
    re.IGNORECASE,
)


def _parse_uzs_amount(raw: str) -> int | None:
    digits = re.sub(r"\s+", "", raw.strip())
    if not digits.isdigit():
        return None
    value = int(digits)
    return value if value > 0 else None


def parse_budget_from_text(text: str) -> tuple[int | None, int | None]:
    """Return (min_price, max_price) in UZS when phrases like '100 000 so'mgacha' appear."""
    lowered = text.lower()
    max_price: int | None = None
    min_price: int | None = None

    for match in _BUDGET_RE.finditer(lowered):
        amount = _parse_uzs_amount(match.group("amount"))
        if amount is None:
            continue
        span = lowered[match.end() : match.end() + 12]
        if "dan" in span and "gacha" not in span[:6]:
            min_price = amount
        else:
            max_price = amount

    if max_price is None:
        if "arzon" in lowered or "byudjet" in lowered or "budget" in lowered:
            for match in _UZS_RE.finditer(lowered):
                amount = _parse_uzs_amount(match.group("amount"))
                if amount and amount <= 5_000_000:
                    max_price = amount
                    break
        elif re.search(r"\b(\d{2,3})\s*ming\b", lowered):
            m = re.search(r"\b(\d{2,3})\s*ming\b", lowered)
            if m:
                max_price = int(m.group(1)) * 1000

    return min_price, max_price


def filter_catalog_items_for_intent(items: list[dict[str, Any]], source_text: str) -> list[dict[str, Any]]:
    """Drop obvious mismatches (e.g. krossovka when user asked for mayka/tursik)."""
    if not items or not wants_clothing_not_shoes(source_text):
        return items

    def blob(row: dict[str, Any]) -> str:
        attrs = row.get("attributes") if isinstance(row.get("attributes"), dict) else {}
        return " ".join(
            str(x or "")
            for x in (
                row.get("name"),
                row.get("category"),
                attrs.get("category"),
                attrs.get("sub_category"),
                attrs.get("root_category"),
            )
        ).lower()

    filtered = [row for row in items if not any(tok in blob(row) for tok in FOOTWEAR_TOKENS)]
    return filtered if filtered else items


def parse_category_hint(text: str) -> str | None:
    lowered = text.lower()
    for hint, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in lowered for kw in keywords):
            return hint
    return None


def parse_garment_slot_keywords(text: str) -> list[str]:
    """O'zbekcha slang: mayka, tursik, futbolka…"""
    lowered = (text or "").lower()
    hits: list[str] = []
    for slot, keywords in GARMENT_SLOT_KEYWORDS.items():
        if any(kw in lowered for kw in keywords):
            hits.append(slot)
    return hits


def wants_clothing_not_shoes(text: str) -> bool:
    slots = parse_garment_slot_keywords(text)
    if slots:
        return True
    lowered = (text or "").lower()
    return any(k in lowered for k in ("mayka", "tursik", "trusik", "futbolka", "ichki", "ko'ylak", "koylak", "kurtka", "shim"))


def parse_sale_type(text: str) -> str | None:
    lowered = text.lower()
    if any(k in lowered for k in ("optom", "ulgurji", "ulguirji", "seriya", "partiya", "katta hajm")):
        return "Optom"
    if any(k in lowered for k in ("chakana", "dona", "bitta", "retail")):
        return "Chakana"
    return None


def _match_from_map(text: str, mapping: dict[str, tuple[str, ...]]) -> str | None:
    lowered = text.lower()
    for label, keywords in mapping.items():
        if any(kw in lowered for kw in keywords):
            return label
    return None


def parse_bazaar_intent(text: str) -> dict[str, str | None]:
    return {
        "root_category": _match_from_map(text, ROOT_CATEGORY_KEYWORDS),
        "sub_category": _match_from_map(text, SUB_CATEGORY_KEYWORDS),
        "market_zone": _match_from_map(text, MARKET_ZONE_KEYWORDS),
        "block_sector": _match_from_map(text, BLOCK_SECTOR_KEYWORDS),
    }


_LOOK_TRIGGERS = ("look", "obraz", "kombin", "komplekt", "kiyinish", "stil taklif", "qber", "bering", "yig'ib")
_OCCASION_KEYWORDS: dict[str, tuple[str, ...]] = {
    "universitet": ("universitet", "univer", "talaba", "dars"),
    "ish": ("ishga", "ofis", "ish kuni", "meeting"),
    "to'y": ("to'y", "toy", "nikoh", "kelin"),
    "dam olish": ("dam olish", "sayr", "dam"),
    "sport": ("sport", "zal", "futbol"),
}


def parse_look_intent(text: str) -> dict[str, Any]:
    """Detect look/outfit requests with optional occasion and budget (e.g. universitetga look, 500 ming)."""
    from app.ai.intent_analyzer import analyze_stylist_intent

    analyzed = analyze_stylist_intent(text or "")
    lowered = (text or "").lower().strip()
    min_p = analyzed.get("min_price")
    max_p = analyzed.get("max_price")
    if max_p is None:
        min_p, max_p = parse_budget_from_text(text)
    occasion: str | None = None
    for key, keywords in _OCCASION_KEYWORDS.items():
        if any(kw in lowered for kw in keywords):
            occasion = key
            break
    is_look = any(t in lowered for t in _LOOK_TRIGGERS) or occasion is not None
    return {
        "is_look_request": is_look or analyzed.get("is_wardrobe_request"),
        "is_wardrobe_request": analyzed.get("is_wardrobe_request"),
        "is_pagination": analyzed.get("is_pagination"),
        "vibe_tags": analyzed.get("vibe_tags") or [],
        "budget_fx_note": analyzed.get("budget_fx_note"),
        "occasion": occasion or analyzed.get("occasion"),
        "min_price": min_p,
        "max_price": max_p,
        "category_hint": parse_category_hint(text),
        "bazaar": parse_bazaar_intent(text),
        "raw_query": text.strip(),
    }


def build_catalog_search_query(text: str, category_hint: str | None) -> str:
    """Strip budget noise; keep fashion intent for embedding."""
    q = text.strip()
    q = _BUDGET_RE.sub(" ", q)
    q = re.sub(r"\s+", " ", q).strip()
    for slot in parse_garment_slot_keywords(text):
        if slot.replace("'", "") not in q.lower().replace("'", ""):
            q = f"{slot} {q}".strip()
    if category_hint and category_hint not in q.lower():
        q = f"{category_hint} {q}".strip()
    return q or "kiyim"


def format_product_rich_line(item: dict[str, Any]) -> str:
    shop = item.get("shop") if isinstance(item.get("shop"), dict) else {}
    name = str(item.get("name") or "Mahsulot")
    price = item.get("price")
    price_txt = f"{int(price):,} so'm".replace(",", " ") if price is not None else "narx katalogda"
    loc_parts: list[str] = []
    if shop.get("floor"):
        loc_parts.append(str(shop["floor"]))
    if shop.get("section") or shop.get("shop_number"):
        loc_parts.append(str(shop.get("section") or shop.get("shop_number")))
    label = shop.get("location_label") or shop.get("location")
    if label:
        location = str(label)
    else:
        if shop.get("ipadrom"):
            loc_parts.insert(0, str(shop["ipadrom"]))
        location = ", ".join(loc_parts) if loc_parts else "Ippodrom bozori"
    sale = item.get("sale_type") or "Chakana"
    min_qty = item.get("min_order_quantity") or 1
    qty_note = f", min {min_qty} dona" if sale == "Optom" and int(min_qty) > 1 else ""
    return f"{name} — {price_txt} [{sale}{qty_note}] ({location})"


def build_rich_suggestion_paragraph(items: list[dict[str, Any]], *, intro: str | None = None) -> str:
    if not items:
        return ""
    lines = [format_product_rich_line(p) for p in items[:6]]
    head = intro or "Sizga mana bu ajoyib variantlarni taklif qilaman:"
    return head + "\n" + "\n".join(f"• {line}" for line in lines)


def build_jonli_katalog_natijasi(
    *,
    exact_items: list[dict[str, Any]],
    vector_neighbors: list[dict[str, Any]],
) -> dict[str, Any]:
    """Pack exact + pgvector neighbor rows for the LLM — never a static fallback string."""
    seen: set[str] = set()
    merged: list[dict[str, Any]] = []
    for row in [*exact_items, *vector_neighbors]:
        pid = str(row.get("id") or "")
        if not pid or pid in seen:
            continue
        seen.add(pid)
        merged.append(row)

    exact_ids = {str(p.get("id")) for p in exact_items if p.get("id")}
    neighbor_only = [p for p in merged if str(p.get("id")) not in exact_ids]

    if exact_items and neighbor_only:
        match_mode = "mixed"
    elif exact_items:
        match_mode = "exact"
    elif merged:
        match_mode = "vector_neighbors"
    else:
        match_mode = "empty"

    return {
        "exact_count": len(exact_items),
        "vector_neighbor_count": len(neighbor_only),
        "match_mode": match_mode,
        "vector_neighbors": merged,
        "is_fallback": match_mode in {"vector_neighbors", "mixed"},
    }


def contains_banned_hallucination(text: str) -> bool:
    lowered = text.lower()
    return any(term in lowered for term in BANNED_HALLUCINATION_TERMS)


def scrub_hallucinated_phrases(text: str) -> str:
    cleaned = text
    for term in BANNED_HALLUCINATION_TERMS:
        cleaned = re.sub(re.escape(term), "", cleaned, flags=re.IGNORECASE)
    return re.sub(r"\s{2,}", " ", cleaned).strip()
