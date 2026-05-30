"""Stylist client profile across turns — budget, style, last picks."""

from __future__ import annotations

import json
from typing import Any

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings

_FOLLOWUP_WORDS = (
    "yana",
    "boshqasi",
    "boshqa variant",
    "arzonroq",
    "qimmatroq",
    "o'sha",
    "oshancha",
    "xuddi shu",
    "shunga o'xshash",
    "ko'proq",
    "emas",
    "mos emas",
    "noto'g'ri",
    "jinnim",
    "jinnimsa",
    "kiyadmi",
    "kiyiladi",
    "boshqa",
    "o'rniga",
)


class StylistSessionStore:
    def __init__(self) -> None:
        self._redis = Redis.from_url(get_settings().redis_url, decode_responses=True)

    def _key(self, user_id: str, thread_id: str) -> str:
        return f"stylist_session:{user_id}:{thread_id}"

    async def load(self, user_id: str, thread_id: str) -> dict[str, Any]:
        try:
            raw = await self._redis.get(self._key(user_id, thread_id))
        except RedisError:
            return {}
        if not raw:
            return {}
        try:
            data = json.loads(raw)
            return data if isinstance(data, dict) else {}
        except json.JSONDecodeError:
            return {}

    async def save(self, user_id: str, thread_id: str, payload: dict[str, Any]) -> None:
        try:
            await self._redis.set(
                self._key(user_id, thread_id),
                json.dumps(payload, ensure_ascii=True),
                ex=86400 * 14,
            )
        except RedisError:
            return


def _is_followup(user_message: str) -> bool:
    lowered = (user_message or "").lower()
    return any(w in lowered for w in _FOLLOWUP_WORDS)


def merge_session_into_analysis(
    analysis: dict[str, Any],
    session: dict[str, Any],
    user_message: str,
) -> dict[str, Any]:
    """Carry style/budget from prior turns when user continues the conversation."""
    if not session:
        return analysis

    out = dict(analysis)
    meta = dict(out.get("_guardrail_meta") or {})

    followup = _is_followup(user_message)
    if followup or not out.get("budget_uzs") or int(out.get("budget_uzs") or 0) < 10_000:
        prev_budget = session.get("budget_uzs")
        if prev_budget:
            out["budget_uzs"] = int(prev_budget)
            meta["budget"] = int(prev_budget)
            meta["_budget_uzs"] = int(prev_budget)

    if followup or out.get("style") in (None, "", "casual"):
        prev_style = session.get("style")
        if prev_style and out.get("style") == "casual":
            out["style"] = prev_style
            meta["style"] = prev_style

    if out.get("gender") in (None, "", "unknown") and session.get("gender"):
        out["gender"] = session["gender"]

    if not out.get("search_keywords") and session.get("search_keywords"):
        out["search_keywords"] = session["search_keywords"]

    if followup and session.get("style") in ("sport", "gym"):
        out["style"] = session["style"]
        meta["style"] = session["style"]
        if out.get("intent") == "shopping":
            out["wants_outfit"] = True

    if followup and session.get("gender") in ("erkak", "ayol"):
        out["gender"] = session["gender"]
        meta["gender"] = session["gender"]

    out["_guardrail_meta"] = meta
    return out


def session_from_analysis(
    analysis: dict[str, Any],
    *,
    product_ids: list[str] | None = None,
    previous: dict[str, Any] | None = None,
) -> dict[str, Any]:
    prev = previous or {}
    return {
        "style": analysis.get("style") or prev.get("style"),
        "age_group": analysis.get("age_group") or prev.get("age_group"),
        "gender": analysis.get("gender") or prev.get("gender"),
        "budget_uzs": analysis.get("budget_uzs") or prev.get("budget_uzs"),
        "search_keywords": analysis.get("search_keywords") or prev.get("search_keywords"),
        "last_summary": analysis.get("summary_uz") or prev.get("last_summary"),
        "last_product_ids": product_ids or prev.get("last_product_ids") or [],
        "locale": prev.get("locale"),
        "size": prev.get("size"),
        "favorite_colors": prev.get("favorite_colors"),
        "liked_product_ids": prev.get("liked_product_ids"),
        "disliked_product_ids": prev.get("disliked_product_ids"),
        "recent_order_categories": prev.get("recent_order_categories"),
    }
