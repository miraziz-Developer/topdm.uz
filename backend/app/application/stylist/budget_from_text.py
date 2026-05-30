"""Extract min/max price hints from free-text stylist queries (Uzbek). Mirrors frontend/src/lib/budget-query.ts."""

from __future__ import annotations

import re
from dataclasses import dataclass


def _normalize(text: str) -> str:
    t = text.lower()
    for ch in "\u2018\u2019\u201a\u201b\u2032\u2035\u02bb\u02bc`\u00b4\uff07\u201d\u201c":
        t = t.replace(ch, "'")
    return t


def _digits_to_int(s: str) -> int | None:
    digits = re.sub(r"\s+", "", s)
    if not digits.isdigit():
        return None
    return int(digits)


@dataclass
class BudgetHints:
    min_price: float | None = None
    max_price: float | None = None


def parse_budget_from_text(text: str | None) -> BudgetHints:
    if not text or not text.strip():
        return BudgetHints()

    n = _normalize(text)

    m = re.search(r"(\d+)\s*ming(?:\s*(?:so'?m|sum))?[^\d]{0,12}gacha", n)
    if m:
        return BudgetHints(max_price=float(int(m.group(1)) * 1000))

    m = re.search(r"(\d+)\s*ming(?:\s*(?:so'?m|sum))?\s*dan", n)
    if m:
        return BudgetHints(min_price=float(int(m.group(1)) * 1000))

    m = re.search(r"(\d[\d\s]{2,})\s*so'?mgacha", n)
    if m:
        v = _digits_to_int(m.group(1))
        if v is not None:
            return BudgetHints(max_price=float(v))

    m = re.search(r"(\d[\d\s]{2,})\s*(?:so'?m|sum)?\s*gacha", n)
    if m:
        v = _digits_to_int(m.group(1))
        if v is not None:
            return BudgetHints(max_price=float(v))

    m = re.search(r"(\d[\d\s]{2,})\s+gacha\b", n)
    if m:
        v = _digits_to_int(m.group(1))
        if v is not None:
            return BudgetHints(max_price=float(v))

    m = re.search(r"gacha\s*(\d[\d\s]{2,})", n)
    if m:
        v = _digits_to_int(m.group(1))
        if v is not None:
            return BudgetHints(max_price=float(v))

    m = re.search(r"(\d[\d\s]{2,})\s*(?:dan|-)\s*(\d[\d\s]{2,})", n)
    if m:
        lo = _digits_to_int(m.group(1))
        hi = _digits_to_int(m.group(2))
        if lo is not None and hi is not None:
            return BudgetHints(min_price=float(lo), max_price=float(hi))

    m = re.search(r"(?:arzon|byudjet|budget)[^\d]{0,16}(\d[\d\s]{2,})", n)
    if m:
        v = _digits_to_int(m.group(1))
        if v is not None:
            return BudgetHints(max_price=float(v))

    return BudgetHints()


def merge_payload_budget(text: str | None, min_price: float | None, max_price: float | None) -> tuple[float | None, float | None]:
    hints = parse_budget_from_text(text)
    eff_min = float(min_price) if min_price is not None else hints.min_price
    eff_max = float(max_price) if max_price is not None else hints.max_price
    return eff_min, eff_max
