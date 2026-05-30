"""
Strict rule-based routing mixer for outfit composition.

Separates catalog rows into top / bottom / footwear / accessory slots before the
chat UI or LLM narrative sees them — prevents jackets in the pants slot and
blocks sport/casual vs formal mismatches.
"""

from __future__ import annotations

from itertools import product as cartesian
from typing import Any

from app.services.semantic_guardrails import (
    filter_db_by_guardrails,
    infer_product_gender,
    merge_guardrail_meta,
    normalize_gender,
    parse_guardrail_meta_from_text,
)


def _guardrail_filtered_catalog(
    catalog_items: list[dict[str, Any]],
    user_intent: str,
) -> list[dict[str, Any]]:
    if not user_intent or not catalog_items:
        return catalog_items
    meta = merge_guardrail_meta(parse_guardrail_meta_from_text(user_intent), user_intent)
    meta["_user_blob"] = user_intent
    filtered = filter_db_by_guardrails(catalog_items, meta)
    return filtered if filtered else catalog_items

# Canonical DB category tokens (plus Uzbek aliases seen in seed data)
TOP_CATEGORY_TOKENS = frozenset(
    {
        "top",
        "kurtka",
        "ko'ylak",
        "koylak",
        "futbolka",
        "xudi",
        "hoodie",
        "sviter",
        "polo",
        "bluzka",
        "jacket",
        "shirt",
        "ustki",
    }
)
BOTTOM_CATEGORY_TOKENS = frozenset(
    {
        "bottom",
        "shim",
        "jinsi",
        "shortik",
        "jofers",
        "pant",
        "trouser",
        "pastki",
    }
)
SHOE_CATEGORY_TOKENS = frozenset(
    {
        "shoes",
        "poyabzal",
        "krossovka",
        "tufli",
        "etik",
        "shlyopka",
        "footwear",
    }
)
ACCESSORY_CATEGORY_TOKENS = frozenset(
    {
        "accessory",
        "aksessuar",
        "sumka",
        "kamar",
        "belt",
    }
)

TOP_NAME_HINTS = (
    "futbolka",
    "ko'ylak",
    "koylak",
    "xudi",
    "hoodie",
    "sviter",
    "kurtka",
    "jacket",
    "polo",
    "bluzka",
    "svitshot",
    "sweater",
    "palto",
    "blazer",
)
BOTTOM_NAME_HINTS = ("shim", "jinsi", "shortik", "jofers", "short", "pant", "trouser", "chino")
SHOE_NAME_HINTS = ("krossovka", "tufli", "etik", "shlyopka", "sandal", "poyabzal", "sneaker", "boot")
FORMAL_HINTS = ("tufli", "kostyum", "klassik", "oxford", "loafer", "mokasin", "rasmiy", "formal")
SPORT_CASUAL_HINTS = ("sport", "krossovka", "jinsi", "futbolka", "casual", "ko'cha", "universitet", "street")


def _text_blob(product: dict[str, Any]) -> str:
    parts = [
        str(product.get("category") or ""),
        str(product.get("root_category") or ""),
        str(product.get("sub_category") or ""),
        str(product.get("name") or ""),
        str(product.get("style") or ""),
    ]
    return " ".join(parts).lower()


def _price(product: dict[str, Any]) -> float:
    raw = product.get("price_uzs")
    if raw is None:
        raw = product.get("price")
    try:
        return float(raw or 0)
    except (TypeError, ValueError):
        return 0.0


def classify_slot(product: dict[str, Any]) -> str | None:
    """Return top | bottom | shoes | accessory | None (strict single slot)."""
    cat = str(product.get("category") or "").lower().strip()
    blob = _text_blob(product)

    if cat in SHOE_CATEGORY_TOKENS or any(h in blob for h in SHOE_NAME_HINTS):
        if any(h in blob for h in BOTTOM_NAME_HINTS) and not any(h in blob for h in SHOE_NAME_HINTS):
            pass
        else:
            return "shoes"

    if cat in BOTTOM_CATEGORY_TOKENS or any(h in blob for h in BOTTOM_NAME_HINTS):
        if any(h in blob for h in ("kurtka", "jacket")) and not any(h in blob for h in BOTTOM_NAME_HINTS):
            return "top"
        if any(h in blob for h in TOP_NAME_HINTS) and not any(h in blob for h in BOTTOM_NAME_HINTS):
            return "top"
        return "bottom"

    if cat in TOP_CATEGORY_TOKENS or any(h in blob for h in TOP_NAME_HINTS):
        return "top"

    if cat in ACCESSORY_CATEGORY_TOKENS or any(h in blob for h in ("kamar", "sumka", "belt", "belbog")):
        return "accessory"

    return None


def infer_product_style(product: dict[str, Any]) -> str:
    """Normalize garment style tag: sport | casual | formal | classic."""
    explicit = str(product.get("style") or "").strip().lower()
    if explicit in ("sport", "sports", "athletic"):
        return "sport"
    if explicit in ("formal", "classic", "business", "office"):
        return "formal"
    if explicit in ("casual", "street", "everyday"):
        return "casual"

    blob = _text_blob(product)
    if any(h in blob for h in ("krossovka", "sport", "trening", "futbolka")):
        return "sport"
    if any(h in blob for h in FORMAL_HINTS):
        return "formal"
    return "casual"


def infer_target_style(target_style: str | None, user_intent: str = "") -> str:
    """Map LLM / user phrases to sport | casual | formal | classic."""
    blob = f"{target_style or ''} {user_intent}".lower()
    if any(h in blob for h in ("sport", "krossovka", "gym", "fitness", "trening")):
        return "sport"
    if any(h in blob for h in ("classic", "quiet luxury", "tailoring", "klassika", "poll")):
        return "classic"
    if any(h in blob for h in ("formal", "rasmiy", "kostyum", "office", "ish", "klassik")):
        return "formal"
    if target_style:
        normalized = target_style.strip().lower()
        if normalized in ("sport", "casual", "formal", "classic"):
            return normalized
    return "casual"


def _style_compatible(product: dict[str, Any], target_style: str) -> bool:
    garment_style = infer_product_style(product)
    blob = _text_blob(product)
    cat = str(product.get("category") or "").lower().strip()
    if target_style == "sport":
        if any(m in blob for m in ("maktab", "forma", "sarpo", "kelin", "kostyum kurtka")):
            return False
        if any(h in blob for h in ("kurtka", "jacket", "vetrovka", "bomber", "xudi", "hoodie")):
            return True
        if any(m in blob for m in SPORT_CASUAL_HINTS) or "majmua" in blob or "futbolka" in blob:
            return True
        if "krossovka" in blob or ("sport" in blob and "kross" in blob):
            return True
        if cat in BOTTOM_CATEGORY_TOKENS or any(h in blob for h in BOTTOM_NAME_HINTS):
            return True
        return False
    if garment_style == target_style:
        return True
    if target_style in ("sport", "casual") and garment_style in ("sport", "casual"):
        return True
    if target_style in ("classic", "formal") and garment_style in ("classic", "formal", "casual"):
        return True
    if target_style == "formal":
        if "krossovka" in blob or "sport" in blob:
            return False
        return garment_style in ("formal", "classic")
    return False


def _gender_compatible(product: dict[str, Any], target_gender: str) -> bool:
    if target_gender not in ("erkak", "ayol"):
        return True
    pg = infer_product_gender(product)
    if pg in ("erkak", "ayol"):
        return pg == target_gender
    return True


def _resolve_outfit_gender(user_intent: str, meta_gender: str) -> str:
    g = normalize_gender(meta_gender, user_intent)
    if g in ("erkak", "ayol"):
        return g
    return "erkak"


def _sport_rank(product: dict[str, Any]) -> int:
    blob = _text_blob(product)
    score = 0
    for marker in ("sport majmua", "sport kostyum", "sport krossovka", "trening"):
        if marker in blob:
            score += 12
    for marker in ("sport", "trening", "futbolka", "majmua", "krossovka"):
        if marker in blob:
            score += 6
    if "ko'ylak" in blob and "sport" not in blob:
        score -= 8
    if "chino" in blob:
        score -= 8
    return score


def _sort_pool_for_style(pool: list[dict[str, Any]], target_style: str) -> None:
    if target_style == "sport":
        pool.sort(key=lambda p: (-_sport_rank(p), _price(p)))
    else:
        pool.sort(key=_price)


def _partition_products(db_products: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    buckets: dict[str, list[dict[str, Any]]] = {
        "top": [],
        "bottom": [],
        "shoes": [],
        "accessory": [],
    }
    for row in db_products:
        slot = classify_slot(row)
        if slot in buckets:
            buckets[slot].append(row)
    return buckets


def _filter_style_pool(pool: list[dict[str, Any]], target_style: str) -> list[dict[str, Any]]:
    matched = [p for p in pool if _style_compatible(p, target_style)]
    if target_style == "sport":
        return matched
    return matched or pool


def _filter_gender_pool(pool: list[dict[str, Any]], target_gender: str) -> list[dict[str, Any]]:
    return [p for p in pool if _gender_compatible(p, target_gender)]


def _cheapest_under_budget_combo(
    tops: list[dict[str, Any]],
    bottoms: list[dict[str, Any]],
    shoes: list[dict[str, Any]],
    max_budget: float,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]] | None:
    tops_sorted = sorted(tops, key=_price)
    bottoms_sorted = sorted(bottoms, key=_price)
    shoes_sorted = sorted(shoes, key=_price)

    best: tuple[dict[str, Any], dict[str, Any], dict[str, Any]] | None = None
    best_total = float("inf")

    for t, b, s in cartesian(tops_sorted[:12], bottoms_sorted[:12], shoes_sorted[:12]):
        total = _price(t) + _price(b) + _price(s)
        if total <= max_budget and total < best_total:
            best = (t, b, s)
            best_total = total

    return best


def assemble_strict_combination(
    db_products: list[dict[str, Any]],
    target_style: str,
    max_budget: float,
    *,
    user_intent: str = "",
) -> dict[str, Any]:
    """
    Rule-based mixer: allocate slots, filter by style, resolve budget.

    Returns dict with top/bottom/shoes/accessory keys or {"error": "..."}.
    """
    style = infer_target_style(target_style, user_intent)
    meta = merge_guardrail_meta(parse_guardrail_meta_from_text(user_intent), user_intent)
    outfit_gender = _resolve_outfit_gender(user_intent, str(meta.get("gender") or ""))
    buckets = _partition_products(db_products)

    tops = _filter_gender_pool(_filter_style_pool(buckets["top"], style), outfit_gender)
    bottoms = _filter_gender_pool(_filter_style_pool(buckets["bottom"], style), outfit_gender)
    shoes = _filter_gender_pool(_filter_style_pool(buckets["shoes"], style), outfit_gender)
    accessories = _filter_gender_pool(_filter_style_pool(buckets["accessory"], style), outfit_gender)

    if not tops or not bottoms or not shoes:
        return {"error": "Mos kombinatsiya topilmadi", "target_style": style}

    _sort_pool_for_style(tops, style)
    _sort_pool_for_style(bottoms, style)
    _sort_pool_for_style(shoes, style)
    if accessories:
        _sort_pool_for_style(accessories, style)

    budget_ceiling = float(max_budget) if max_budget and max_budget > 0 else float("inf")

    selected_top = tops[0]
    selected_bottom = bottoms[0]
    selected_shoes = shoes[0]
    selected_accessory = accessories[0] if accessories else None

    total_price = _price(selected_top) + _price(selected_bottom) + _price(selected_shoes)
    if selected_accessory and budget_ceiling == float("inf"):
        total_price += _price(selected_accessory)

    is_valid = total_price <= budget_ceiling

    if not is_valid and budget_ceiling != float("inf"):
        combo = _cheapest_under_budget_combo(tops, bottoms, shoes, budget_ceiling)
        if combo is None:
            return {
                "error": "Budjet ichida mos kombinatsiya topilmadi",
                "target_style": style,
                "total_price": total_price,
                "is_valid": False,
            }
        selected_top, selected_bottom, selected_shoes = combo
        total_price = _price(selected_top) + _price(selected_bottom) + _price(selected_shoes)
        is_valid = total_price <= budget_ceiling

        if accessories and is_valid:
            acc_budget = budget_ceiling - total_price
            affordable = [a for a in sorted(accessories, key=_price) if _price(a) <= acc_budget]
            selected_accessory = affordable[0] if affordable else None
            if selected_accessory:
                total_price += _price(selected_accessory)

    return {
        "top": selected_top,
        "bottom": selected_bottom,
        "shoes": selected_shoes,
        "accessory": selected_accessory,
        "total_price": total_price,
        "is_valid": is_valid,
        "target_style": style,
    }


def assembled_to_look_payload(assembled: dict[str, Any]) -> dict[str, Any]:
    """Map mixer output to look_groups + selected_product_ids for the agent layer."""
    if assembled.get("error"):
        return {"error": assembled["error"], "selected_product_ids": [], "look_groups": []}

    role_map = {
        "top": "ustki",
        "bottom": "pastki",
        "shoes": "poyabzal",
        "accessory": "aksessuar",
    }
    selected: list[dict[str, Any]] = []
    groups: list[dict[str, Any]] = []

    for slot in ("top", "bottom", "shoes", "accessory"):
        item = assembled.get(slot)
        if not item or not item.get("id"):
            continue
        selected.append(item)
        groups.append(
            {
                "role": role_map[slot],
                "product_id": str(item["id"]),
                "rationale": f"strict_mixer:{assembled.get('target_style', 'casual')}",
            }
        )

    return {
        "selected_product_ids": [str(p["id"]) for p in selected],
        "look_groups": groups,
        "total_price": assembled.get("total_price"),
        "is_valid": assembled.get("is_valid", True),
        "target_style": assembled.get("target_style"),
    }


def is_valid_look_product_ids(ids: list[str], catalog_items: list[dict[str, Any]]) -> bool:
    """True when IDs map to distinct core slots (no duplicate top/bottom/shoes)."""
    if not ids:
        return False
    by_id = {str(p.get("id")): p for p in catalog_items if p.get("id")}
    core_seen: set[str] = set()
    for pid in ids:
        prod = by_id.get(str(pid))
        if not prod:
            return False
        slot = classify_slot(prod)
        if slot in ("top", "bottom", "shoes"):
            if slot in core_seen:
                return False
            core_seen.add(slot)
    return len(core_seen) >= 2


def strict_product_ids_from_catalog(
    catalog_items: list[dict[str, Any]],
    *,
    target_style: str = "",
    max_budget: float = 0,
    user_intent: str = "",
    look_intent: dict[str, Any] | None = None,
) -> list[str]:
    """Deterministic ID list for UI cards — no LLM involvement."""
    if look_intent and look_intent.get("max_price") is not None:
        try:
            max_budget = float(look_intent["max_price"])
        except (TypeError, ValueError):
            pass
    style_hint = target_style
    if look_intent:
        style_hint = style_hint or str(look_intent.get("style") or look_intent.get("occasion") or "")
    style = infer_target_style(style_hint, user_intent)
    catalog = _guardrail_filtered_catalog(catalog_items, user_intent)
    assembled = assemble_strict_combination(
        catalog,
        style,
        max_budget,
        user_intent=user_intent,
    )
    return assembled_to_look_payload(assembled).get("selected_product_ids") or []


def merge_strict_with_llm(
    composed: dict[str, Any],
    catalog_items: list[dict[str, Any]],
    *,
    target_style: str,
    max_budget: float,
    user_intent: str = "",
) -> dict[str, Any]:
    """
    Run strict mixer first; keep LLM narrative but bind IDs to valid slots.
    """
    catalog = _guardrail_filtered_catalog(catalog_items, user_intent)
    strict = assemble_strict_combination(
        catalog,
        target_style,
        max_budget,
        user_intent=user_intent,
    )
    payload = assembled_to_look_payload(strict)
    if payload.get("error"):
        return {**composed, "selected_product_ids": [], "look_groups": [], "strict_error": payload["error"]}

    allowed = set(payload["selected_product_ids"])
    llm_ids = [str(i) for i in composed.get("selected_product_ids") or [] if str(i) in allowed]

    final_ids = llm_ids if len(llm_ids) >= 2 else payload["selected_product_ids"]
    by_id = {str(p.get("id")): p for p in catalog_items if p.get("id")}
    groups: list[dict[str, Any]] = []
    seen: set[str] = set()
    for pid in final_ids:
        prod = by_id.get(pid)
        if not prod:
            continue
        slot = classify_slot(prod)
        role = {"top": "ustki", "bottom": "pastki", "shoes": "poyabzal", "accessory": "aksessuar"}.get(
            slot or "", "aksessuar"
        )
        if role in seen:
            continue
        seen.add(role)
        groups.append({"role": role, "product_id": pid, "rationale": "strict_mixer_validated"})

    if len(groups) < 2:
        groups = payload["look_groups"]
        final_ids = payload["selected_product_ids"]

    return {
        **composed,
        "selected_product_ids": final_ids[:8],
        "look_groups": groups,
        "strict_total_price": payload.get("total_price"),
        "strict_budget_ok": payload.get("is_valid"),
    }
