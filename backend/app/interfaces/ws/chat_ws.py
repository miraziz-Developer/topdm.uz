from __future__ import annotations

import asyncio
import json
from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError
from loguru import logger

from app.application.merchant.chat_service import ChatServiceError, MerchantChatService
from app.core.config import get_settings
from app.infrastructure.auth.jwt import decode_access_token
from app.infrastructure.cache.chat_pubsub import ChatPubSubGateway, chat_channel
from app.infrastructure.db.session import AsyncSessionFactory
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway

router = APIRouter()

_PING_INTERVAL_SECONDS = 25.0
_RECONNECT_HINT = {
    "type": "system",
    "code": "reconnect_hint",
    "message": "Ulanish uzildi. Qayta ulaning — oxirgi xabarlar saqlanadi.",
}


async def _resolve_ws_identity(
    *,
    role: str,
    token: str | None,
    session_id: str | None,
    thread_id: UUID,
) -> tuple[str, str, UUID | None]:
    """Returns (sender_role, client_key, merchant_shop_id_if_merchant)."""
    async with AsyncSessionFactory() as session:
        from app.infrastructure.repositories.chat_repo import ChatRepository

        chat_repo = ChatRepository(session)
        thread = await chat_repo.get_thread(thread_id)
        if not thread:
            raise ChatServiceError("not_found", "Thread not found")

    if role == "merchant":
        if not token:
            raise ChatServiceError("auth_required", "Merchant token required")
        try:
            payload = decode_access_token(token)
        except JWTError as exc:
            raise ChatServiceError("auth_invalid", "Invalid token") from exc
        if str(payload.get("role") or "") != "merchant":
            raise ChatServiceError("auth_invalid", "Merchant role required")
        shop_id_raw = payload.get("shop_id")
        if not shop_id_raw or UUID(str(shop_id_raw)) != thread.shop_id:
            raise ChatServiceError("auth_invalid", "Token shop mismatch")
        return "merchant", f"merchant:{shop_id_raw}", UUID(str(shop_id_raw))

    key = (session_id or "").strip()
    if len(key) < 4:
        raise ChatServiceError("auth_required", "session_id query param required for customers")
    return "customer", f"customer:{key}", None


async def _safe_send_json(websocket: WebSocket, payload: dict) -> bool:
    try:
        await websocket.send_json(payload)
        return True
    except Exception:
        return False


async def _safe_send_text(websocket: WebSocket, text: str) -> bool:
    try:
        await websocket.send_text(text)
        return True
    except Exception:
        return False


@router.websocket("/ws/chat/{thread_id}")
async def chat_websocket(
    websocket: WebSocket,
    thread_id: UUID,
    role: str = Query(default="customer"),
    token: str | None = Query(default=None),
    session_id: str | None = Query(default=None),
) -> None:
    pubsub_gateway = ChatPubSubGateway()
    settings = get_settings()
    notifier = TelegramNotifierGateway(settings.telegram_bot_token) if settings.telegram_bot_token else None

    try:
        sender_role, client_key, merchant_shop_id = await _resolve_ws_identity(
            role=role,
            token=token,
            session_id=session_id,
            thread_id=thread_id,
        )
    except ChatServiceError as exc:
        await websocket.close(code=4403, reason=exc.code)
        return

    if not await pubsub_gateway.check_ws_rate_limit(client_key):
        await websocket.close(code=4429, reason="rate_limit")
        return

    await websocket.accept()
    await _safe_send_json(
        websocket,
        {"type": "system", "code": "connected", "thread_id": str(thread_id), "role": sender_role},
    )

    if sender_role == "merchant" and merchant_shop_id:
        await pubsub_gateway.set_merchant_online(str(merchant_shop_id))

    redis_pubsub = pubsub_gateway.pubsub()
    channel = chat_channel(str(thread_id))
    await redis_pubsub.subscribe(channel)

    stop_event = asyncio.Event()

    async def redis_listener() -> None:
        try:
            async for raw in redis_pubsub.listen():
                if stop_event.is_set():
                    break
                if raw.get("type") != "message":
                    continue
                data = raw.get("data")
                if not data:
                    continue
                ok = await _safe_send_text(websocket, data if isinstance(data, str) else str(data))
                if not ok:
                    break
        except asyncio.CancelledError:
            return
        except Exception:
            logger.exception("chat_ws_redis_listener_failed", thread_id=str(thread_id))
            await _safe_send_json(websocket, {**_RECONNECT_HINT, "source": "redis_listener"})

    async def heartbeat() -> None:
        try:
            while not stop_event.is_set():
                await asyncio.sleep(_PING_INTERVAL_SECONDS)
                if stop_event.is_set():
                    break
                if not await _safe_send_json(websocket, {"type": "ping", "thread_id": str(thread_id)}):
                    break
        except asyncio.CancelledError:
            return

    listener_task = asyncio.create_task(redis_listener())
    heartbeat_task = asyncio.create_task(heartbeat())

    try:
        while True:
            if not await pubsub_gateway.check_ws_rate_limit(client_key):
                await _safe_send_json(
                    websocket,
                    {"type": "error", "code": "rate_limit", "message": "Too many messages"},
                )
                continue

            raw = await websocket.receive_text()
            if raw.strip().lower() in {"ping", '{"type":"ping"}'}:
                await _safe_send_json(websocket, {"type": "pong", "thread_id": str(thread_id)})
                continue

            metadata: dict = {"transport": "websocket"}
            try:
                payload = json.loads(raw)
                if isinstance(payload, dict) and payload.get("type") == "ping":
                    await _safe_send_json(websocket, {"type": "pong", "thread_id": str(thread_id)})
                    continue
                body = str(payload.get("body") or payload.get("text") or "").strip()
                if isinstance(payload, dict):
                    extra = payload.get("metadata")
                    if isinstance(extra, dict):
                        metadata.update(extra)
                    products = payload.get("products")
                    if isinstance(products, list) and products:
                        metadata["products"] = products
            except json.JSONDecodeError:
                body = raw.strip()

            if not body and not metadata.get("products"):
                continue

            if sender_role == "merchant" and merchant_shop_id:
                await pubsub_gateway.set_merchant_online(str(merchant_shop_id))

            async with AsyncSessionFactory() as session:
                service = MerchantChatService(session, notifier=notifier, pubsub=pubsub_gateway)
                try:
                    await service.send_message(
                        thread_id,
                        sender_role=sender_role,
                        body=body or "Mahsulot",
                        metadata=metadata,
                    )
                except ChatServiceError as exc:
                    await _safe_send_json(
                        websocket,
                        {"type": "error", "code": exc.code, "message": str(exc)},
                    )
    except WebSocketDisconnect:
        logger.debug("chat_ws_disconnect", thread_id=str(thread_id), role=sender_role)
    finally:
        stop_event.set()
        listener_task.cancel()
        heartbeat_task.cancel()
        await asyncio.gather(listener_task, heartbeat_task, return_exceptions=True)
        try:
            await redis_pubsub.unsubscribe(channel)
            await redis_pubsub.aclose()
        except Exception:
            logger.warning("chat_ws_pubsub_cleanup_failed", thread_id=str(thread_id))
