"""Normalize stylist budgets — USD/EUR → UZS, fix Groq returning 100 instead of 1_300_000."""

from __future__ import annotations

import re

from app.ai.intent_analyzer import parse_budget_with_fx


def normalize_budget_uzs(raw: object | None, user_message: str, *, default: int = 2_000_000) -> int:
    text = user_message or ""
    _min_fx, max_fx, _note = parse_budget_with_fx(text)

    parsed: int | None = None
    if raw is not None:
        try:
            parsed = int(float(raw))
        except (TypeError, ValueError):
            parsed = None

    if max_fx is not None and max_fx > 0:
        if parsed is None or parsed < 50_000:
            return max_fx

    if parsed is None or parsed <= 0:
        return default

    lowered = text.lower()
    if parsed < 50_000 and re.search(r"(\$|usd|dollar|dollars|€|eur)", lowered):
        return max_fx or default

    # Groq sometimes returns "100" for "100$"
    if parsed <= 500 and re.search(r"\b\d+\s*(\$|usd|dollar)", lowered):
        return max_fx or default

    return parsed
