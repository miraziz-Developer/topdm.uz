from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.merchant.chat_service import ChatServiceError, MerchantChatService
from app.application.merchant.schemas import ChatMessageCreateRequest, ChatThreadCreateRequest
from app.core.config import get_settings
from app.infrastructure.auth.deps import AuthUser, get_optional_user, require_merchant
from app.infrastructure.auth.merchant_resolve import resolve_merchant_shop
from app.infrastructure.cache.chat_pubsub import ChatPubSubGateway
from app.infrastructure.cache.redis_gateway import RedisCacheGateway
from app.infrastructure.db.session import get_db_session
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway
from app.infrastructure.repositories.chat_repo import ChatRepository

router = APIRouter(prefix="/chat", tags=["shop-chat"])


def _chat_service(db: AsyncSession) -> MerchantChatService:
    settings = get_settings()
    notifier = TelegramNotifierGateway(settings.telegram_bot_token) if settings.telegram_bot_token else None
    return MerchantChatService(db, notifier=notifier, pubsub=ChatPubSubGateway())


def _http_error(exc: ChatServiceError) -> HTTPException:
    status = 404 if exc.code == "not_found" else 400
    return HTTPException(status_code=status, detail={"code": exc.code, "message": str(exc)})


def _customer_key_for_request(user: AuthUser | None, session_id: str | None) -> str | None:
    if user:
        return str(user.id)
    sid = (session_id or "").strip()
    if len(sid) >= 8:
        return sid
    return None


async def _assert_thread_access(
    db: AsyncSession,
    thread_id: UUID,
    *,
    user: AuthUser | None,
    session_id: str | None,
) -> None:
    chat = ChatRepository(db)
    thread = await chat.get_thread(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    if user:
        shop = await resolve_merchant_shop(db, user)
        if shop and shop.id == thread.shop_id:
            return

    customer_key = _customer_key_for_request(user, session_id)
    if customer_key and customer_key == thread.customer_key:
        return

    raise HTTPException(status_code=403, detail="Bu chatga kirish huquqi yo'q")


@router.post("/threads")
async def create_chat_thread(
    body: ChatThreadCreateRequest,
    request: Request,
    session_id: str | None = Query(default=None, min_length=8, max_length=128),
    user: AuthUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    ip = request.client.host if request.client else "unknown"
    cache = RedisCacheGateway()
    if not await cache.check_fixed_window(f"chat:open:{ip}", limit=20, window_seconds=3600):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    expected_key = _customer_key_for_request(user, session_id)
    if not expected_key or body.customer_key.strip() != expected_key:
        raise HTTPException(status_code=403, detail="customer_key mismatch")

    service = _chat_service(db)
    try:
        thread = await service.open_thread(
            shop_id=body.shop_id,
            customer_key=body.customer_key.strip(),
            customer_display_name=body.customer_display_name,
        )
    except ChatServiceError as exc:
        raise _http_error(exc) from exc
    return {"thread": thread.model_dump(mode="json")}


@router.get("/threads/{thread_id}/messages")
async def list_thread_messages(
    thread_id: UUID,
    limit: int = Query(default=100, ge=1, le=200),
    session_id: str | None = Query(default=None, min_length=8, max_length=128),
    user: AuthUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    await _assert_thread_access(db, thread_id, user=user, session_id=session_id)
    service = _chat_service(db)
    try:
        messages = await service.list_messages(thread_id, limit=limit)
    except ChatServiceError as exc:
        raise _http_error(exc) from exc
    return {"items": [m.model_dump(mode="json") for m in messages]}


@router.post("/threads/{thread_id}/messages")
async def post_thread_message(
    thread_id: UUID,
    body: ChatMessageCreateRequest,
    role: str = Query(default="customer"),
    session_id: str | None = Query(default=None, min_length=8, max_length=128),
    user: AuthUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    pubsub = ChatPubSubGateway()
    client_key = session_id or (str(user.id) if user else "anonymous")
    if not await pubsub.check_ws_rate_limit(f"http:{client_key}"):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    sender = "merchant" if role == "merchant" else "customer"
    merchant_shop_id: UUID | None = None
    if sender == "merchant":
        if user is None:
            raise HTTPException(status_code=401, detail="Merchant authentication required")
        shop = await resolve_merchant_shop(db, user)
        if not shop:
            raise HTTPException(status_code=403, detail="Merchant shop not found")
        merchant_shop_id = shop.id
    else:
        await _assert_thread_access(db, thread_id, user=user, session_id=session_id)

    service = _chat_service(db)
    try:
        if sender == "merchant" and merchant_shop_id:
            chat = ChatRepository(db)
            thread = await chat.get_thread(thread_id)
            if not thread or thread.shop_id != merchant_shop_id:
                raise HTTPException(status_code=403, detail="Bu chat sizning do'koningizga tegishli emas")
            await service.touch_merchant_presence(merchant_shop_id)
        msg = await service.send_message(
            thread_id,
            sender_role=sender,
            body=body.body,
            metadata=body.metadata or None,
        )
    except ChatServiceError as exc:
        raise _http_error(exc) from exc
    return {"message": msg.model_dump(mode="json")}


@router.post("/threads/{thread_id}/presence/merchant")
async def merchant_presence_ping(
    thread_id: UUID,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if not user.shop_id:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    chat = ChatRepository(db)
    thread = await chat.get_thread(thread_id)
    if not thread or thread.shop_id != user.shop_id:
        raise HTTPException(status_code=403, detail="Bu chat sizning do'koningizga tegishli emas")
    service = _chat_service(db)
    await service.touch_merchant_presence(user.shop_id)
    return {"status": "online"}
