"""LangGraph-aligned wardrobe memory — recommended_product_ids exclusion loop."""

from __future__ import annotations

from typing import Any

from app.ai.intent_analyzer import is_pagination_request
from app.ai.wardrobe_session import WardrobeSessionStore


def get_recommended_ids(session: dict[str, Any]) -> list[str]:
    """Unified list of already-served product UUIDs for NOT IN queries."""
    primary = session.get("recommended_product_ids")
    if isinstance(primary, list) and primary:
        return [str(i) for i in primary if i]
    legacy = session.get("shown_product_ids") or []
    return [str(i) for i in legacy if i]


async def load_recommended_ids(user_id: str, thread_id: str) -> list[str]:
    store = WardrobeSessionStore()
    session = await store.load(user_id, thread_id)
    return get_recommended_ids(session)


async def merge_recommended_ids(
    user_id: str,
    thread_id: str,
    new_ids: list[str],
    *,
    bump_page_on_pagination: bool = False,
    user_text: str = "",
) -> dict[str, Any]:
    store = WardrobeSessionStore()
    cur = await store.load(user_id, thread_id)
    if bump_page_on_pagination or is_pagination_request(user_text):
        cur = await store.bump_page(user_id, thread_id)
    merged = list(get_recommended_ids(cur))
    for pid in new_ids:
        s = str(pid).strip()
        if s and s not in merged:
            merged.append(s)
    cur["recommended_product_ids"] = merged[-120:]
    cur["shown_product_ids"] = cur["recommended_product_ids"]
    await store.save(user_id, thread_id, cur)
    return cur
