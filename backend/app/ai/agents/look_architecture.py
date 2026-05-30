"""Look slot normalization — trusts Groq picks (no strict mixer override)."""

from __future__ import annotations

from typing import Any

from app.services.stylist import classify_slot


def enforce_look_architecture(
    composed: dict[str, Any],
    catalog_items: list[dict[str, Any]],
    *,
    user_intent: str = "",
    look_intent: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Keep AI-selected IDs; only map slots for wardrobe UI."""
    _ = user_intent, look_intent
    allowed = {str(p.get("id")) for p in catalog_items if p.get("id")}
    ids = [str(i) for i in composed.get("selected_product_ids") or [] if str(i) in allowed]
    groups = composed.get("look_groups")
    if not isinstance(groups, list):
        groups = []

    if not groups and ids:
        by_id = {str(p.get("id")): p for p in catalog_items if p.get("id")}
        role_map = {"top": "ustki", "bottom": "pastki", "shoes": "poyabzal", "accessory": "aksessuar"}
        built: list[dict[str, Any]] = []
        for pid in ids:
            prod = by_id.get(pid) or {}
            slot = classify_slot(prod)
            role = role_map.get(slot or "", "aksessuar")
            built.append({"role": role, "product_id": pid, "rationale": "groq_ai"})
        groups = built

    normalized_groups: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for group in groups:
        if not isinstance(group, dict):
            continue
        pid = str(group.get("product_id") or "").strip()
        if not pid or pid not in allowed or pid in seen_ids:
            continue
        seen_ids.add(pid)
        normalized_groups.append(
            {
                "role": str(group.get("role") or "aksessuar"),
                "product_id": pid,
                "rationale": str(group.get("rationale") or "groq_ai"),
            }
        )

    final_ids = [g["product_id"] for g in normalized_groups] or ids
    return {
        **composed,
        "selected_product_ids": final_ids[:8],
        "look_groups": normalized_groups,
        "engine": composed.get("engine") or "groq_ai",
    }
