"""Locked catalog truth — Groq narrates only pre-fetched DB rows (exact price/name/id)."""

from __future__ import annotations

import re
from typing import Any

LOCKED_CATALOG_RULE = """
LOCKED CATALOG (absolute):
- You may ONLY describe products listed in locked_catalog.
- Use EXACT name and price_uzs from locked_catalog — never invent or round differently.
- selected_product_ids MUST be UUIDs from locked_catalog only.
- If a product is not in locked_catalog, do not mention it in assistant_text.
"""

_UZS_IN_TEXT = re.compile(
    r"(\d[\d\s]{2,})\s*(?:so['']?m|sum|uzs|сум)",
    re.IGNORECASE,
)


def build_locked_catalog(products: list[dict[str, Any]]) -> list[dict[str, Any]]:
    locked: list[dict[str, Any]] = []
    for p in products:
        pid = str(p.get("id") or "").strip()
        if not pid:
            continue
        price_uzs = int(float(p.get("price_uzs") if p.get("price_uzs") is not None else p.get("price") or 0))
        locked.append(
            {
                "id": pid,
                "name": str(p.get("name") or ""),
                "price_uzs": price_uzs,
                "category": p.get("category"),
                "color": p.get("color"),
            }
        )
    return locked


def _price_key(uzs: int) -> str:
    return f"{uzs:,}".replace(",", " ")


def align_assistant_text_to_catalog(assistant_text: str, locked: list[dict[str, Any]]) -> str:
    """Replace hallucinated UZS amounts with catalog truth when product names are nearby."""
    if not assistant_text or not locked:
        return assistant_text
    by_name = {str(r["name"]).lower(): int(r["price_uzs"]) for r in locked if r.get("name")}
    text = assistant_text
    for name, price_uzs in by_name.items():
        if len(name) < 4:
            continue
        wrong = _UZS_IN_TEXT.findall(text)
        for raw in wrong:
            digits = re.sub(r"\s+", "", raw)
            try:
                val = int(digits)
            except ValueError:
                continue
            if val != price_uzs and name in text.lower():
                text = text.replace(f"{raw} so'm", f"{_price_key(price_uzs)} so'm", 1)
                text = text.replace(f"{raw} sum", f"{_price_key(price_uzs)} so'm", 1)
    return text


def finalize_stylist_response(
    composed: dict[str, Any],
    catalog_items: list[dict[str, Any]],
    *,
    user_intent: str = "",
    look_intent: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Bind Groq output to catalog UUIDs — never override picks with rule-based mixer."""
    _ = user_intent, look_intent
    locked = build_locked_catalog(catalog_items)
    allowed = {r["id"] for r in locked}
    ids = [str(i) for i in composed.get("selected_product_ids") or [] if str(i) in allowed]

    groups = composed.get("look_groups")
    if isinstance(groups, list):
        for group in groups:
            if isinstance(group, dict):
                pid = str(group.get("product_id") or "")
                if pid in allowed and pid not in ids:
                    ids.append(pid)

    text = align_assistant_text_to_catalog(str(composed.get("assistant_text") or ""), locked)
    if not text and locked and ids:
        picked = [r for r in locked if r["id"] in ids][:6]
        lines = [f"• {r['name']} — {_price_key(r['price_uzs'])} so'm" for r in picked]
        text = "Mana tanlagan variantlar:\n" + "\n".join(lines)
    return {
        "assistant_text": text,
        "selected_product_ids": ids[:8],
        "look_groups": composed.get("look_groups") or [],
        "locked_catalog": locked,
        "engine": composed.get("engine") or "groq_ai",
    }
