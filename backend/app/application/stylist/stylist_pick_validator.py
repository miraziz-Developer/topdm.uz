"""Post-Groq validation — filter AI picks that violate intent (not rule-based selection)."""

from __future__ import annotations

from typing import Any

from app.services.semantic_guardrails import (
    GYM_SPORT_MARKERS,
    infer_product_gender,
    normalize_gender,
    normalize_style_tag,
)

_GYM_FORBIDDEN_IN_NAME = (
    "sviter",
    "ko'ylak",
    "koylak",
    "chino",
    "maktab",
    "forma",
    "kostyum",
    "ofis",
    "klassik ko'ylak",
    "sarpo",
    "kelin",
    "yubka",
)
_SPORT_OK_MARKERS = ("sport", "trening", "futbolka", "kross", "gym", "jogger", "majmua")


def _blob(product: dict[str, Any]) -> str:
    parts = [
        str(product.get("name") or ""),
        str(product.get("category") or ""),
        str(product.get("root_category") or ""),
        str(product.get("sub_category") or ""),
    ]
    return " ".join(parts).lower()


def _price_uzs(product: dict[str, Any]) -> int:
    raw = product.get("price_uzs")
    if raw is None:
        raw = product.get("price")
    try:
        return int(float(raw or 0))
    except (TypeError, ValueError):
        return 0


def _is_sport_context(meta: dict[str, Any], user_message: str) -> bool:
    style = normalize_style_tag(str(meta.get("style") or ""), user_message)
    if style in ("gym", "sport"):
        return True
    text = (user_message or "").lower()
    return any(m in text for m in GYM_SPORT_MARKERS)


def validate_ai_picks(
    product_ids: list[str],
    catalog: list[dict[str, Any]],
    *,
    meta: dict[str, Any] | None = None,
    user_message: str = "",
    look_groups: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Filter invalid UUIDs after Groq selection. Does not replace picks with rule-mixer.
    Returns filtered ids, groups, and human-readable rejection reasons for retry prompts.
    """
    meta = meta or {}
    by_id = {str(p.get("id")): p for p in catalog if p.get("id")}
    sport_ctx = _is_sport_context(meta, user_message)
    target_gender = normalize_gender(str(meta.get("gender") or ""), user_message)
    budget = meta.get("budget") or meta.get("_budget_uzs")
    try:
        budget_uzs = int(float(budget)) if budget is not None else 0
    except (TypeError, ValueError):
        budget_uzs = 0

    valid_ids: list[str] = []
    rejections: list[str] = []

    for pid in product_ids:
        pid_s = str(pid or "").strip()
        if not pid_s:
            continue
        product = by_id.get(pid_s)
        if not product:
            rejections.append(f"id_not_in_catalog:{pid_s[:8]}")
            continue

        if product.get("is_available") is False:
            rejections.append(f"out_of_stock:{product.get('name', '')[:32]}")
            continue
        stock = int(product.get("stock_count") or 0)
        if stock <= 0:
            rejections.append(f"no_stock:{product.get('name', '')[:32]}")
            continue

        blob = _blob(product)
        price = _price_uzs(product)

        if budget_uzs > 0 and price > int(budget_uzs * 1.12):
            rejections.append(f"over_budget:{product.get('name', pid_s)[:32]}")
            continue

        if sport_ctx:
            if any(bad in blob for bad in _GYM_FORBIDDEN_IN_NAME):
                if not any(ok in blob for ok in _SPORT_OK_MARKERS):
                    rejections.append(f"not_for_gym:{product.get('name', '')[:40]}")
                    continue

        if target_gender in ("erkak", "ayol"):
            p_gender = infer_product_gender(product)
            if p_gender in ("erkak", "ayol") and p_gender != target_gender:
                rejections.append(f"gender_mismatch:{product.get('name', '')[:40]}")
                continue

        valid_ids.append(pid_s)

    valid_set = set(valid_ids)
    filtered_groups: list[dict[str, Any]] = []
    if look_groups:
        for group in look_groups:
            if not isinstance(group, dict):
                continue
            pid = str(group.get("product_id") or "").strip()
            if pid in valid_set:
                filtered_groups.append(group)

    return {
        "product_ids": valid_ids,
        "look_groups": filtered_groups,
        "rejections": rejections,
        "ok": len(valid_ids) >= 1 and len(rejections) == 0,
    }
