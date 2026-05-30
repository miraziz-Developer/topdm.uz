#!/usr/bin/env python3
"""Validate app/ai Groq config and JSON stylist schemas (no live API call)."""

from __future__ import annotations

import json
import sys

from app.ai.config import (
    GROQ_API_BASE,
    default_chat_payload,
    groq_chat_completions_url,
    resolve_groq_agent_model,
    resolve_groq_chat_model,
)
from app.ai.agents.persona import GLOBAL_FASHION_GURU_CORE, PREMIUM_MARKDOWN_ARCHITECTURE, VISUAL_SEARCH_JSON_PROMPT
from app.application.agents.bozor_chat_system import FINALIZE_SYSTEM_PROMPT, TOOLS_SYSTEM_PROMPT


def main() -> int:
    errors: list[str] = []

    if GROQ_API_BASE != "https://api.groq.com/openai/v1":
        errors.append("GROQ_API_BASE mismatch")
    if not groq_chat_completions_url().endswith("/chat/completions"):
        errors.append("groq_chat_completions_url invalid")

    chat_model = resolve_groq_chat_model()
    agent_model = resolve_groq_agent_model()
    if "70b" not in chat_model and "versatile" not in chat_model:
        errors.append(f"unexpected chat model: {chat_model}")

    payload = default_chat_payload(
        model=chat_model,
        messages=[{"role": "user", "content": "test"}],
        stream=True,
    )
    if payload.get("stream") is not True:
        errors.append("stream=True not preserved in default_chat_payload")
    payload_off = default_chat_payload(
        model=agent_model,
        messages=[{"role": "user", "content": "test"}],
        stream=False,
        response_format={"type": "json_object"},
    )
    if payload_off.get("stream") is not False:
        errors.append("stream=False not preserved")

    sample_finalize = {
        "assistant_text": "## Look\n- ustki",
        "selected_product_ids": ["00000000-0000-0000-0000-000000000001"],
        "blocks": [{"type": "product_cards", "product_ids": ["00000000-0000-0000-0000-000000000001"]}],
    }
    try:
        json.dumps(sample_finalize)
    except TypeError as exc:
        errors.append(f"finalize schema not serializable: {exc}")

    sample_look = {
        "assistant_text": "Uka, mana look.",
        "selected_product_ids": ["00000000-0000-0000-0000-000000000001"],
        "look_groups": [{"role": "ustki", "product_id": "00000000-0000-0000-0000-000000000001", "rationale": "mos"}],
    }
    try:
        json.dumps(sample_look)
    except TypeError as exc:
        errors.append(f"look schema not serializable: {exc}")

    if "json" not in FINALIZE_SYSTEM_PROMPT.lower():
        errors.append("FINALIZE_SYSTEM_PROMPT missing JSON hint")
    if "jonli_katalog" not in TOOLS_SYSTEM_PROMPT and "vector" not in TOOLS_SYSTEM_PROMPT:
        errors.append("TOOLS_SYSTEM_PROMPT missing catalog hint")
    if "selected_product_ids" not in VISUAL_SEARCH_JSON_PROMPT:
        errors.append("VISUAL_SEARCH_JSON_PROMPT missing selected_product_ids")
    if "GLOBAL FASHION GURU" not in GLOBAL_FASHION_GURU_CORE:
        errors.append("GLOBAL_FASHION_GURU_CORE missing identity")
    if "Ustki qism" not in PREMIUM_MARKDOWN_ARCHITECTURE:
        errors.append("PREMIUM_MARKDOWN_ARCHITECTURE missing section template")
    if "BUDGET ALLOCATION" not in VISUAL_SEARCH_JSON_PROMPT:
        errors.append("VISUAL_SEARCH_JSON_PROMPT missing budget synthesis")

    print(f"chat_model={chat_model} agent_model={agent_model}")
    print(f"url={groq_chat_completions_url()}")
    if errors:
        for e in errors:
            print(f"FAIL: {e}")
        return 1
    print("validate_ai_config: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
