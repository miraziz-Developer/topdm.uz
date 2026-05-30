"""Outfit synthesizer — Groq 70B + raw vector rows; zero static narrative fallbacks."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

from app.ai.agents.persona import VISUAL_SEARCH_JSON_PROMPT
from app.ai.agents.look_architecture import enforce_look_architecture
from app.ai.catalog_truth import LOCKED_CATALOG_RULE, build_locked_catalog, finalize_stylist_response
from app.ai.config import require_groq_api_key
from app.application.agents.bozor_chat_catalog import build_jonli_katalog_natijasi, format_product_rich_line
from app.infrastructure.ai_clients.groq import GroqClient


def compact_catalog_rows(items: list[dict[str, Any]], *, limit: int = 24) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for p in items[:limit]:
        shop = p.get("shop") if isinstance(p.get("shop"), dict) else {}
        floor = shop.get("floor") or shop.get("level")
        loc = shop.get("location_label") or shop.get("section") or shop.get("shop_number") or shop.get("block_sector")
        rows.append(
            {
                "id": str(p.get("id") or ""),
                "name": p.get("name"),
                "category": p.get("category") or p.get("root_category"),
                "color": p.get("color"),
                "price": p.get("price_uzs") if p.get("price_uzs") is not None else p.get("price"),
                "sale_type": p.get("sale_type"),
                "market_zone": shop.get("market_zone") or shop.get("ipadrom"),
                "shop_floor": floor,
                "shop_location": loc,
                "line": format_product_rich_line(p),
            }
        )
    return [r for r in rows if r["id"]]


def filter_product_ids(selected: list[Any], allowed: set[str]) -> list[str]:
    out: list[str] = []
    for raw in selected:
        pid = str(raw or "").strip()
        if pid and pid in allowed and pid not in out:
            out.append(pid)
    return out


def build_look_user_payload(
    *,
    user_intent: str,
    query_label: str | None,
    look_intent: dict[str, Any] | None,
    vision: dict[str, Any] | None,
    jonli: dict[str, Any],
    catalog_rows: list[dict[str, Any]],
) -> str:
    intent = look_intent or {}
    budget_max = intent.get("max_price")
    budget_min = intent.get("min_price")
    prices = [float(r["price"]) for r in catalog_rows if r.get("price") is not None]
    price_bands = {
        "min_uzs": min(prices) if prices else None,
        "max_uzs": max(prices) if prices else None,
        "median_uzs": sorted(prices)[len(prices) // 2] if prices else None,
    }
    return json.dumps(
        {
            "user_intent": user_intent or query_label or "Look taklif",
            "query_label": query_label,
            "look_intent": intent,
            "occasion": intent.get("occasion"),
            "budget_min_uzs": budget_min,
            "budget_max_uzs": budget_max,
            "budget_allocation_hint_pct": {
                "ustki": "35-45",
                "pastki": "30-40",
                "poyabzal": "15-25",
                "aksessuar": "5-10",
            },
            "available_price_bands": price_bands,
            "vision": vision or {},
            "[jonli_katalog_natijalari]": jonli,
            "vector_similarity_fallback_rows": catalog_rows,
            "locked_catalog": build_locked_catalog(
                [{"id": r["id"], "name": r.get("name"), "price": r.get("price")} for r in catalog_rows]
            ),
            "locked_catalog_rule": LOCKED_CATALOG_RULE,
        },
        ensure_ascii=True,
    )


async def groq_compose_look(user_payload: str, *, allowed: set[str], stream: bool = False) -> dict[str, Any]:
    require_groq_api_key()
    groq = GroqClient()
    if stream:
        _, raw = await groq.chat_json_stream_collect(
            system_prompt=VISUAL_SEARCH_JSON_PROMPT,
            user_prompt=user_payload,
        )
    else:
        raw = await groq.chat_json(system_prompt=VISUAL_SEARCH_JSON_PROMPT, user_prompt=user_payload)

    text = str(raw.get("assistant_text") or "").strip()
    ids = filter_product_ids(list(raw.get("selected_product_ids") or []), allowed)
    groups = raw.get("look_groups") if isinstance(raw.get("look_groups"), list) else []
    if not ids and groups:
        for g in groups:
            if isinstance(g, dict) and g.get("product_id"):
                ids = filter_product_ids([*ids, g["product_id"]], allowed)
    # Never inject random catalog UUIDs here — slot mixer runs in enforce_look_architecture.
    if not text:
        raise ValueError("Groq stylist returned empty assistant_text")
    return {"assistant_text": text, "selected_product_ids": ids[:8], "look_groups": groups}


async def compose_elite_look(
    *,
    user_intent: str,
    catalog_items: list[dict[str, Any]],
    jonli_katalog: dict[str, Any] | None = None,
    vision: dict[str, Any] | None = None,
    query_label: str | None = None,
    look_intent: dict[str, Any] | None = None,
    stream: bool = False,
) -> dict[str, Any]:
    jonli = jonli_katalog or build_jonli_katalog_natijasi(
        exact_items=[p for p in catalog_items if not p.get("is_fallback")],
        vector_neighbors=catalog_items,
    )
    neighbors = list(jonli.get("vector_neighbors") or catalog_items)
    allowed = {str(p.get("id")) for p in neighbors if p.get("id")}
    rows = compact_catalog_rows(neighbors)
    payload = build_look_user_payload(
        user_intent=user_intent,
        query_label=query_label,
        look_intent=look_intent,
        vision=vision,
        jonli=jonli,
        catalog_rows=rows,
    )
    composed: dict[str, Any] | None = None
    try:
        from app.services.groq_stylist import get_groq_stylist_service

        composed = await get_groq_stylist_service().compose_look(
            user_intent or query_label or "",
            neighbors,
            look_intent=look_intent,
        )
    except Exception:
        composed = None

    is_chitchat = bool(composed and composed.get("route") == "chitchat")
    if not is_chitchat and (not composed or not composed.get("selected_product_ids")):
        composed = await groq_compose_look(payload, allowed=allowed, stream=stream)

    if is_chitchat:
        return {
            "assistant_text": str(composed.get("assistant_text") or "").strip(),
            "selected_product_ids": [],
            "look_groups": [],
        }

    composed = enforce_look_architecture(
        composed,
        neighbors,
        user_intent=user_intent,
        look_intent=look_intent,
    )
    return finalize_stylist_response(
        composed,
        neighbors,
        user_intent=user_intent,
        look_intent=look_intent,
    )


async def stream_elite_look(
    *,
    user_intent: str,
    catalog_items: list[dict[str, Any]],
    jonli_katalog: dict[str, Any] | None = None,
    vision: dict[str, Any] | None = None,
    query_label: str | None = None,
    look_intent: dict[str, Any] | None = None,
) -> AsyncIterator[dict[str, Any]]:
    jonli = jonli_katalog or build_jonli_katalog_natijasi(
        exact_items=[p for p in catalog_items if not p.get("is_fallback")],
        vector_neighbors=catalog_items,
    )
    neighbors = list(jonli.get("vector_neighbors") or catalog_items)
    allowed = {str(p.get("id")) for p in neighbors if p.get("id")}
    rows = compact_catalog_rows(neighbors)
    user_payload = build_look_user_payload(
        user_intent=user_intent,
        query_label=query_label,
        look_intent=look_intent,
        vision=vision,
        jonli=jonli,
        catalog_rows=rows,
    )
    require_groq_api_key()
    groq = GroqClient()
    messages = [
        {"role": "system", "content": VISUAL_SEARCH_JSON_PROMPT},
        {"role": "user", "content": user_payload},
    ]
    parts: list[str] = []
    async for token in groq.stream_completion(messages=messages, temperature=0.12):
        parts.append(token)
        yield {"type": "token", "delta": token}
    raw = "".join(parts).strip()
    cleaned = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    parsed = json.loads(cleaned)
    text = str(parsed.get("assistant_text") or "").strip()
    ids = filter_product_ids(list(parsed.get("selected_product_ids") or []), allowed)
    composed = enforce_look_architecture(
        {
            "assistant_text": text,
            "selected_product_ids": ids[:8],
            "look_groups": parsed.get("look_groups") if isinstance(parsed.get("look_groups"), list) else [],
        },
        neighbors,
        user_intent=user_intent,
        look_intent=look_intent,
    )
    finalized = finalize_stylist_response(
        composed,
        neighbors,
        user_intent=user_intent,
        look_intent=look_intent,
    )
    yield {
        "type": "done",
        "assistant_text": finalized["assistant_text"],
        "selected_product_ids": finalized["selected_product_ids"],
        "look_groups": finalized.get("look_groups") or [],
    }
