"""Groq-only Bozor AI stylist — human conversation + real catalog."""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.stylist.stylist_mini_map import build_stylist_mini_map_block
from app.application.stylist.stylist_session import session_from_analysis
from app.services.groq_stylist import get_groq_stylist_service


def _product_snapshot(product: dict[str, Any]) -> dict[str, Any]:
    shop = product.get("shop") if isinstance(product.get("shop"), dict) else {}
    return {
        "id": str(product.get("id") or ""),
        "name": str(product.get("name") or ""),
        "price": float(product.get("price_uzs") if product.get("price_uzs") is not None else product.get("price") or 0),
        "images": list(product.get("images") or []),
        "category": product.get("category"),
        "is_available": bool(product.get("is_available", True)),
        "is_featured": bool(product.get("is_featured", False)),
        "view_count": int(product.get("view_count") or 0),
        "stock_count": int(product.get("stock_count") or 0),
        "shop": {
            "id": str(shop.get("id") or ""),
            "name": str(shop.get("name") or ""),
            "slug": str(shop.get("slug") or ""),
            "ipadrom": str(shop.get("ipadrom") or shop.get("market_zone") or "Bozor"),
            "floor": shop.get("floor"),
            "shop_number": shop.get("shop_number") or shop.get("section"),
            "section": shop.get("section") or shop.get("shop_number"),
            "market_zone": shop.get("market_zone"),
            "block_sector": shop.get("block_sector"),
            "location_label": shop.get("location_label"),
        },
    }


def _build_blocks(catalog: list[dict[str, Any]], product_ids: list[str]) -> list[dict[str, Any]]:
    by_id = {str(p.get("id")): p for p in catalog if p.get("id")}
    ids: list[str] = []
    items: list[dict[str, Any]] = []
    for raw in product_ids:
        pid = str(raw or "").strip()
        if not pid or pid in ids:
            continue
        product = by_id.get(pid)
        if not product:
            continue
        ids.append(pid)
        items.append(_product_snapshot(product))
    if not items:
        return []
    return [{"type": "product_cards", "product_ids": ids, "items": items}]


async def execute_groq_chat_turn(
    user_text: str,
    catalog: list[dict[str, Any]],
    *,
    analysis: dict[str, Any] | None = None,
    history: list[dict[str, Any]] | None = None,
    session: dict[str, Any] | None = None,
    db: AsyncSession | None = None,
    user_nav_node_id: str | None = None,
) -> dict[str, Any]:
    """Human-like stylist turn — full Groq AI + DB-backed product picks."""
    stylist = get_groq_stylist_service()
    text = (user_text or "").strip()
    semantic = analysis or await stylist.analyze_message(text, history=history, session=session)

    composed = await stylist.run_chat_turn(
        text,
        catalog,
        analysis=semantic,
        history=history,
        session=session,
    )

    assistant_text = str(composed.get("assistant_text") or "").strip()
    product_ids = [str(i) for i in composed.get("selected_product_ids") or [] if str(i)]
    blocks = _build_blocks(catalog, product_ids)

    look_groups = composed.get("look_groups")
    if isinstance(look_groups, list) and look_groups:
        by_id = {str(p.get("id")): p for p in catalog if p.get("id")}
        slots: list[dict[str, Any]] = []
        bundle_ids: list[str] = []
        for group in look_groups:
            if not isinstance(group, dict):
                continue
            pid = str(group.get("product_id") or "")
            product = by_id.get(pid)
            if not product:
                continue
            bundle_ids.append(pid)
            slots.append(
                {
                    "role": str(group.get("role") or "aksessuar"),
                    "product_id": pid,
                    "item": _product_snapshot(product),
                }
            )
        if slots:
            blocks.insert(
                0,
                {
                    "type": "wardrobe_bundle",
                    "slots": slots,
                    "product_ids": bundle_ids,
                },
            )
            blocks = [b for b in blocks if b.get("type") != "product_cards"]
            product_ids = bundle_ids or product_ids

    if db and product_ids and user_nav_node_id:
        has_map = any(b.get("type") == "mini_map" for b in blocks)
        if not has_map:
            mini = await build_stylist_mini_map_block(
                db,
                catalog,
                product_ids,
                start_node_id=user_nav_node_id,
            )
            if mini:
                blocks.append(mini)

    suggestions = composed.get("suggestions") or semantic.get("suggestions") or []
    if not isinstance(suggestions, list):
        suggestions = []

    route = composed.get("route") or semantic.get("intent", "shopping")
    engine = composed.get("engine") or "groq"

    out: dict[str, Any] = {
        "assistant_text": assistant_text,
        "blocks": blocks,
        "suggestions": [str(s) for s in suggestions[:4] if s],
        "route": route,
        "engine": engine,
        "locale": composed.get("locale"),
        "stylist_session": session_from_analysis(
            semantic,
            product_ids=product_ids,
            previous=session,
        ),
    }
    if composed.get("strict_error"):
        out["strict_error"] = composed.get("strict_error")
    return out
