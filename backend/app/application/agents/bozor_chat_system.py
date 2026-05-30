"""System prompts for the Bozor-AI LangGraph chat agent — Global Fashion Guru (Groq 70B)."""

from app.ai.agents.persona import (
    FINALIZE_JSON_CONTRACT,
    GLOBAL_FASHION_GURU_CORE,
    LOOK_SYNTHESIS_ENGINE,
    PREMIUM_MARKDOWN_ARCHITECTURE,
    TOOLS_AGENT_APPEND,
)

TOOLS_SYSTEM_PROMPT = f"""{GLOBAL_FASHION_GURU_CORE}

{LOOK_SYNTHESIS_ENGINE}

{PREMIUM_MARKDOWN_ARCHITECTURE}

{TOOLS_AGENT_APPEND}

LANGUAGE: Respond in Uzbek (lotin) unless the user writes in another language; stay premium and grounded in tool JSON."""

FINALIZE_SYSTEM_PROMPT = FINALIZE_JSON_CONTRACT


def build_finalize_user_payload(
    *,
    user_text: str | None,
    vision: dict | None,
    tool_events: list[dict],
    allowed_product_ids: list[str],
    user_nav_node_id: str,
    catalog_context: dict | None = None,
) -> str:
    import json

    from app.application.agents.bozor_chat_catalog import parse_look_intent

    look_intent = parse_look_intent(user_text or "") if user_text else {}
    catalog = catalog_context or {}
    jonli = catalog.get("jonli_katalog_natijasi") or catalog.get("[jonli_katalog_natijalari]") or {}

    return json.dumps(
        {
            "user_message": user_text or "",
            "vision_attributes": vision,
            "tool_events": tool_events,
            "allowed_only": allowed_product_ids,
            "default_start_node_id": user_nav_node_id,
            "catalog_context": catalog,
            "[jonli_katalog_natijalari]": jonli,
            "vector_neighbor_count": len((jonli or {}).get("vector_neighbors") or []),
            "look_intent": look_intent,
            "budget_max_uzs": look_intent.get("max_price"),
            "budget_min_uzs": look_intent.get("min_price"),
            "markdown_contract": "PREMIUM_MARKDOWN_ARCHITECTURE",
        },
        ensure_ascii=True,
    )
