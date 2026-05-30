"""LLM synthesis for visual search — elite look composition from raw catalog rows."""

from __future__ import annotations

from typing import Any

from app.application.agents.bozor_chat_catalog import build_jonli_katalog_natijasi, parse_look_intent
from app.application.agents.look_composer import compose_elite_look


async def synthesize_visual_search_narrative(
    *,
    query_label: str,
    vision: dict[str, Any],
    catalog_items: list[dict[str, Any]],
    exact_items: list[dict[str, Any]] | None = None,
    budget_max: int | None = None,
    user_intent: str | None = None,
) -> dict[str, Any]:
    """Return assistant_text and stylist-selected product UUIDs."""
    exact = exact_items if exact_items is not None else catalog_items
    jonli = build_jonli_katalog_natijasi(exact_items=exact, vector_neighbors=catalog_items)
    intent_text = user_intent or query_label
    look_intent = parse_look_intent(intent_text)
    if budget_max is not None and look_intent.get("max_price") is None:
        look_intent = {**look_intent, "max_price": budget_max}

    composed = await compose_elite_look(
        user_intent=intent_text,
        catalog_items=list(jonli.get("vector_neighbors") or catalog_items),
        jonli_katalog=jonli,
        vision=vision,
        query_label=query_label,
        look_intent=look_intent,
    )
    return composed
