from __future__ import annotations

import base64
import binascii
import json
import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.config import require_groq_api_key
from app.application.stylist.catalog_fetch import fetch_stylist_catalog
from app.application.stylist.groq_chat_turn import execute_groq_chat_turn
from app.application.stylist.stylist_image_vision import (
    StylistPhotoMode,
    analyze_stylist_user_photo,
    default_text_for_photo_mode,
)
from app.application.stylist.stylist_feedback import StylistFeedbackStore, apply_feedback_to_session
from app.application.stylist.stylist_order_hints import load_recent_order_categories
from app.application.stylist.stylist_session import StylistSessionStore
from app.application.stylist.stylist_user_profile import merge_client_profile
from app.core.client_context import get_locale
from app.infrastructure.cache.chat_history_store import ChatHistoryStore
from app.infrastructure.cache.redis_gateway import RedisCacheGateway
from app.infrastructure.db.session import get_db_session

router = APIRouter(prefix="/chat", tags=["bozor-chat-agent"])


class StylistClientProfileBody(BaseModel):
    size: str | None = Field(default=None, max_length=16)
    favorite_colors: list[str] = Field(default_factory=list)
    locale: str | None = Field(default=None, max_length=8)


class ChatAgentTurnBody(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    thread_id: str = Field("default", max_length=128)
    text: str = ""
    user_nav_node_id: str = Field("entrance-A", max_length=64)
    image_base64: str | None = None
    image_mime: str | None = Field(default=None, description="Optional when using raw base64, e.g. image/jpeg")
    photo_mode: StylistPhotoMode | None = Field(
        default=None,
        description="look_check | personal_style | find_similar — stylist rasm stsenariysi",
    )
    client_profile: StylistClientProfileBody | None = None


class ChatAgentFeedbackBody(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    thread_id: str = Field("default", max_length=128)
    product_id: str = Field(..., min_length=1)
    vote: Literal["like", "dislike"]


def _decode_optional_image(payload: ChatAgentTurnBody) -> tuple[bytes | None, str | None]:
    raw = (payload.image_base64 or "").strip()
    if not raw:
        return None, None
    mime: str | None = payload.image_mime
    if raw.startswith("data:"):
        match = re.match(r"data:([^;]+);base64,(.+)", raw, re.DOTALL | re.IGNORECASE)
        if not match:
            raise HTTPException(status_code=400, detail="Invalid data URL for image_base64")
        mime = match.group(1).strip() or "image/jpeg"
        b64 = match.group(2).strip()
    else:
        b64 = raw
    try:
        data = base64.b64decode(b64, validate=False)
    except binascii.Error as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 image") from exc
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be 8MB or smaller")
    return data, (mime or "image/jpeg").strip() or "image/jpeg"


async def _prepare_stylist_text(body: ChatAgentTurnBody) -> str:
    image_bytes, image_mime = _decode_optional_image(body)
    text = (body.text or "").strip()
    mode: StylistPhotoMode = body.photo_mode or "look_check"

    if image_bytes:
        if not text:
            text = default_text_for_photo_mode(mode)
        try:
            vision = await analyze_stylist_user_photo(
                image_bytes,
                image_mime or "image/jpeg",
                mode,
                user_note=text,
            )
        except Exception as exc:
            from loguru import logger

            logger.warning("stylist_image_vision_failed: {}", exc)
            vision = {
                "stylist_context_uz": "Rasm qabul qilindi, lekin tahlil vaqtincha ishlamadi. Matn bo'yicha maslahat bering.",
                "search_keywords": text,
            }
        ctx = str(vision.get("stylist_context_uz") or "").strip()
        keywords = str(vision.get("search_keywords") or "").strip()
        summary = str(vision.get("summary_uz") or "").strip()
        parts = [text]
        if summary:
            parts.append(f"[Rasm qisqacha: {summary}]")
        if ctx:
            parts.append(f"[Rasm tahlili — stylist]\n{ctx}")
        if keywords and mode == "find_similar":
            parts.append(f"[Katalog qidiruv: {keywords}]")
        text = "\n\n".join(p for p in parts if p)

    return text.strip() or "Salom"


async def _groq_stylist_turn(
    db: AsyncSession,
    text: str,
    *,
    user_id: str,
    thread_id: str,
    user_nav_node_id: str = "entrance-A",
    client_profile: StylistClientProfileBody | None = None,
) -> dict:
    from app.services.groq_stylist import get_groq_stylist_service

    history_store = ChatHistoryStore()
    session_store = StylistSessionStore()
    feedback_store = StylistFeedbackStore()
    history = await history_store.load(user_id, thread_id, max_messages=20)
    session = await session_store.load(user_id, thread_id)

    feedback = await feedback_store.load(user_id, thread_id)
    session = apply_feedback_to_session(session, feedback)

    prof_dict = client_profile.model_dump() if client_profile else {}
    order_cats = await load_recent_order_categories(db, user_id)
    if order_cats:
        prof_dict["recent_order_categories"] = order_cats
    session = merge_client_profile(session, prof_dict, locale=get_locale())

    stylist = get_groq_stylist_service()
    analysis = await stylist.analyze_message(text, history=history, session=session)
    if analysis.get("intent") == "chitchat":
        catalog: list[dict] = []
    else:
        catalog = await fetch_stylist_catalog(db, text, limit=64, analysis=analysis)

    payload = await execute_groq_chat_turn(
        text,
        catalog,
        analysis=analysis,
        history=history,
        session=session,
        db=db,
        user_nav_node_id=user_nav_node_id,
    )

    assistant = str(payload.get("assistant_text") or "").strip()
    if assistant:
        await history_store.append_turn(
            user_id,
            thread_id,
            user_message=text,
            assistant_message=assistant,
        )
    new_session = payload.get("stylist_session")
    if isinstance(new_session, dict):
        await session_store.save(user_id, thread_id, new_session)

    return payload


@router.post("/agent/turn")
async def chat_agent_turn(
    body: ChatAgentTurnBody,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Bozorliii — human-like Groq stylist with conversation memory."""
    try:
        require_groq_api_key()
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    cache = RedisCacheGateway()
    allowed = await cache.check_fixed_window(
        f"ai:chat_agent:{body.user_id}",
        limit=20,
        window_seconds=60,
    )
    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    text = await _prepare_stylist_text(body)
    user_id = body.user_id.strip()
    thread_id = (body.thread_id or "default").strip()

    import asyncio as _asyncio
    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            payload = await _groq_stylist_turn(
                db,
                text,
                user_id=user_id,
                thread_id=thread_id,
                user_nav_node_id=body.user_nav_node_id,
                client_profile=body.client_profile,
            )
            break
        except Exception as exc:
            last_exc = exc
            # Groq rate-limit yoki timeout bo'lsa — 1-2 soniya kutib qayta urinish
            err_str = str(exc).lower()
            if attempt < 2 and any(kw in err_str for kw in ("rate_limit", "429", "timeout", "503")):
                await _asyncio.sleep(1.5 * (attempt + 1))
                continue
            from loguru import logger
            logger.warning("groq_chat_turn_failed attempt={} err={}", attempt, str(exc)[:200])
            raise HTTPException(status_code=502, detail="Groq stylist chat failed") from exc
    else:
        raise HTTPException(status_code=502, detail="Groq stylist chat failed") from last_exc

    return {
        "source": "groq_stylist",
        "assistant_text": payload.get("assistant_text") or "",
        "blocks": payload.get("blocks") or [],
        "suggestions": payload.get("suggestions") or [],
        "route": payload.get("route"),
        "engine": payload.get("engine"),
        "locale": payload.get("locale"),
        "search_deeplink": payload.get("search_deeplink"),
    }


@router.post("/agent/feedback")
async def chat_agent_feedback(body: ChatAgentFeedbackBody) -> dict:
    """Like/dislike on stylist picks — improves next recommendations."""
    store = StylistFeedbackStore()
    result = await store.record(body.user_id.strip(), body.thread_id.strip(), body.product_id, body.vote)
    if not result.get("ok"):
        raise HTTPException(status_code=503, detail=str(result.get("error") or "feedback_failed"))

    session_store = StylistSessionStore()
    session = await session_store.load(body.user_id.strip(), body.thread_id.strip())
    session = apply_feedback_to_session(session, result)
    await session_store.save(body.user_id.strip(), body.thread_id.strip(), session)
    return {"ok": True, "liked": result.get("liked") or [], "disliked": result.get("disliked") or []}


@router.post("/agent/turn/stream")
async def chat_agent_turn_stream(
    body: ChatAgentTurnBody,
    db: AsyncSession = Depends(get_db_session),
) -> StreamingResponse:
    """SSE — human stylist response streamed."""
    try:
        require_groq_api_key()
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    cache = RedisCacheGateway()
    allowed = await cache.check_fixed_window(
        f"ai:chat_agent_stream:{body.user_id}",
        limit=15,
        window_seconds=60,
    )
    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    text = await _prepare_stylist_text(body)
    user_id = body.user_id.strip()
    thread_id = (body.thread_id or "default").strip()

    async def event_gen():
        payload = await _groq_stylist_turn(
            db,
            text,
            user_id=user_id,
            thread_id=thread_id,
            user_nav_node_id=body.user_nav_node_id,
            client_profile=body.client_profile,
        )
        assistant = str(payload.get("assistant_text") or "")
        chunk_size = 20
        for i in range(0, len(assistant), chunk_size):
            yield f"data: {json.dumps({'type': 'token', 'delta': assistant[i : i + chunk_size]}, ensure_ascii=True)}\n\n"
        yield (
            "data: "
            + json.dumps(
                {
                    "type": "done",
                    "assistant_text": assistant,
                    "blocks": payload.get("blocks") or [],
                    "suggestions": payload.get("suggestions") or [],
                    "route": payload.get("route"),
                    "engine": payload.get("engine"),
                    "locale": payload.get("locale"),
                    "search_deeplink": payload.get("search_deeplink"),
                },
                ensure_ascii=True,
            )
            + "\n\n"
        )
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")
