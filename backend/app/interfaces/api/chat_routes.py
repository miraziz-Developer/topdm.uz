from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.merchant.chat_service import ChatServiceError, MerchantChatService
from app.application.merchant.schemas import ChatMessageCreateRequest, ChatThreadCreateRequest
from app.core.config import get_settings
from app.infrastructure.auth.deps import AuthUser, get_optional_user, require_merchant
from app.infrastructure.cache.chat_pubsub import ChatPubSubGateway
from app.infrastructure.db.session import get_db_session
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway

router = APIRouter(prefix="/chat", tags=["shop-chat"])


def _chat_service(db: AsyncSession) -> MerchantChatService:
    settings = get_settings()
    notifier = TelegramNotifierGateway(settings.telegram_bot_token) if settings.telegram_bot_token else None
    return MerchantChatService(db, notifier=notifier, pubsub=ChatPubSubGateway())


def _http_error(exc: ChatServiceError) -> HTTPException:
    status = 404 if exc.code == "not_found" else 400
    return HTTPException(status_code=status, detail={"code": exc.code, "message": str(exc)})


@router.post("/threads")
async def create_chat_thread(
    body: ChatThreadCreateRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = _chat_service(db)
    try:
        thread = await service.open_thread(
            shop_id=body.shop_id,
            customer_key=body.customer_key,
            customer_display_name=body.customer_display_name,
        )
    except ChatServiceError as exc:
        raise _http_error(exc) from exc
    return {"thread": thread.model_dump(mode="json")}


@router.get("/threads/{thread_id}/messages")
async def list_thread_messages(
    thread_id: UUID,
    limit: int = Query(default=100, ge=1, le=200),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
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
    session_id: str | None = Query(default=None),
    user: AuthUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    pubsub = ChatPubSubGateway()
    client_key = session_id or (str(user.id) if user else "anonymous")
    if not await pubsub.check_ws_rate_limit(f"http:{client_key}"):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    sender = "merchant" if role == "merchant" else "customer"
    if sender == "merchant":
        if user is None or user.role != "merchant" or not user.shop_id:
            raise HTTPException(status_code=401, detail="Merchant authentication required")

    service = _chat_service(db)
    try:
        if sender == "merchant" and user and user.shop_id:
            await service.touch_merchant_presence(user.shop_id)
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
    _ = thread_id
    if not user.shop_id:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    service = _chat_service(db)
    await service.touch_merchant_presence(user.shop_id)
    return {"status": "online"}
