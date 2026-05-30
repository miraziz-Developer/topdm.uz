"""Stylist shopper profile — size, colors, feedback memory across turns."""

from __future__ import annotations

from typing import Any

from app.application.stylist.stylist_locale import normalize_stylist_locale


def merge_client_profile(
    session: dict[str, Any],
    client_profile: dict[str, Any] | None,
    *,
    locale: str | None = None,
) -> dict[str, Any]:
    """Merge request profile + session; persist preferences for Groq context."""
    out = dict(session or {})
    prof = dict(client_profile or {})

    loc = normalize_stylist_locale(prof.get("locale") or locale or out.get("locale"))
    out["locale"] = loc

    if prof.get("size"):
        out["size"] = str(prof["size"]).strip()[:16]
    if prof.get("favorite_colors"):
        colors = [str(c).strip() for c in prof["favorite_colors"] if str(c).strip()]
        if colors:
            out["favorite_colors"] = colors[:8]

    for key in ("liked_product_ids", "disliked_product_ids"):
        incoming = prof.get(key)
        if isinstance(incoming, list) and incoming:
            prev = [str(x) for x in out.get(key) or []]
            merged = list(dict.fromkeys(prev + [str(x) for x in incoming if x]))[:40]
            out[key] = merged

    if prof.get("recent_order_categories"):
        cats = [str(c) for c in prof["recent_order_categories"] if c]
        if cats:
            out["recent_order_categories"] = cats[:12]

    return out


def profile_context_block(session: dict[str, Any]) -> str:
    """Human-readable profile for Groq system prompts."""
    if not session:
        return ""
    parts: list[str] = []
    if session.get("size"):
        parts.append(f"O'lcham: {session['size']}")
    if session.get("favorite_colors"):
        parts.append(f"Sevimli ranglar: {', '.join(session['favorite_colors'])}")
    if session.get("gender"):
        parts.append(f"Jins: {session['gender']}")
    if session.get("recent_order_categories"):
        parts.append(f"Oldingi buyurtmalar: {', '.join(session['recent_order_categories'][:6])}")
    liked = session.get("liked_product_ids") or []
    disliked = session.get("disliked_product_ids") or []
    if liked:
        parts.append(f"Yoqgan mahsulotlar (ID): {', '.join(liked[-6:])}")
    if disliked:
        parts.append(f"Yoqmagan mahsulotlar (ID) — TANLAMANG: {', '.join(disliked[-8:])}")
    if not parts:
        return ""
    return "MIJOZ PROFILI:\n- " + "\n- ".join(parts)


def filter_catalog_by_profile(catalog: list[dict[str, Any]], session: dict[str, Any]) -> list[dict[str, Any]]:
    """Drop disliked IDs; prefer in-stock rows."""
    disliked = set(str(x) for x in session.get("disliked_product_ids") or [])
    out: list[dict[str, Any]] = []
    for row in catalog:
        pid = str(row.get("id") or "")
        if pid and pid in disliked:
            continue
        if row.get("is_available") is False:
            continue
        stock = int(row.get("stock_count") or 0)
        if stock <= 0 and row.get("is_available") is not True:
            continue
        out.append(row)
    return out if out else catalog
