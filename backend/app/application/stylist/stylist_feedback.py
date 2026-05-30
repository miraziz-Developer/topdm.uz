"""Like / dislike feedback for stylist picks — Redis-backed."""

from __future__ import annotations

import json
from typing import Any, Literal

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings

Vote = Literal["like", "dislike"]


class StylistFeedbackStore:
    def __init__(self) -> None:
        self._redis = Redis.from_url(get_settings().redis_url, decode_responses=True)

    def _key(self, user_id: str, thread_id: str) -> str:
        return f"stylist_feedback:{user_id}:{thread_id}"

    async def record(
        self,
        user_id: str,
        thread_id: str,
        product_id: str,
        vote: Vote,
    ) -> dict[str, Any]:
        pid = str(product_id or "").strip()
        if not pid:
            return {"ok": False, "error": "missing_product_id"}
        try:
            raw = await self._redis.get(self._key(user_id, thread_id))
            data = json.loads(raw) if raw else {"liked": [], "disliked": []}
        except (RedisError, json.JSONDecodeError):
            data = {"liked": [], "disliked": []}

        liked = [str(x) for x in data.get("liked") or []]
        disliked = [str(x) for x in data.get("disliked") or []]

        if vote == "like":
            if pid not in liked:
                liked.append(pid)
            disliked = [x for x in disliked if x != pid]
        else:
            if pid not in disliked:
                disliked.append(pid)
            liked = [x for x in liked if x != pid]

        payload = {"liked": liked[-40:], "disliked": disliked[-40:]}
        try:
            await self._redis.set(
                self._key(user_id, thread_id),
                json.dumps(payload, ensure_ascii=True),
                ex=86400 * 30,
            )
        except RedisError:
            return {"ok": False, "error": "redis_unavailable"}
        return {"ok": True, **payload}

    async def load(self, user_id: str, thread_id: str) -> dict[str, list[str]]:
        try:
            raw = await self._redis.get(self._key(user_id, thread_id))
        except RedisError:
            return {"liked": [], "disliked": []}
        if not raw:
            return {"liked": [], "disliked": []}
        try:
            data = json.loads(raw)
            return {
                "liked": [str(x) for x in data.get("liked") or []],
                "disliked": [str(x) for x in data.get("disliked") or []],
            }
        except json.JSONDecodeError:
            return {"liked": [], "disliked": []}


def apply_feedback_to_session(session: dict[str, Any], feedback: dict[str, list[str]]) -> dict[str, Any]:
    out = dict(session or {})
    if feedback.get("liked"):
        prev = [str(x) for x in out.get("liked_product_ids") or []]
        out["liked_product_ids"] = list(dict.fromkeys(prev + feedback["liked"]))[-40:]
    if feedback.get("disliked"):
        prev = [str(x) for x in out.get("disliked_product_ids") or []]
        out["disliked_product_ids"] = list(dict.fromkeys(prev + feedback["disliked"]))[-40:]
    return out
