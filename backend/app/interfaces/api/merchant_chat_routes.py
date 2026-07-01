from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.merchant.chat_service import ChatServiceError, MerchantChatService
from app.core.config import get_settings
from app.infrastructure.auth.deps import AuthUser, require_merchant
from app.infrastructure.cache.chat_pubsub import ChatPubSubGateway
from app.infrastructure.db.session import get_db_session
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway

router = APIRouter(prefix="/merchant/chat", tags=["merchant-chat"])


def _service(db: AsyncSession) -> MerchantChatService:
    settings = get_settings()
    notifier = TelegramNotifierGateway(settings.telegram_bot_token) if settings.telegram_bot_token else None
    return MerchantChatService(db, notifier=notifier, pubsub=ChatPubSubGateway())


@router.get("/threads")
async def list_merchant_chat_threads(
    limit: int = Query(default=50, ge=1, le=100),
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if not user.shop_id:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    service = _service(db)
    items = await service.list_shop_threads(user.shop_id, limit=limit)
    total_unread = sum(i.unread_count for i in items)
    return {
        "items": [i.model_dump(mode="json") for i in items],
        "total_unread": total_unread,
    }


@router.get("/threads/{thread_id}/messages")
async def list_merchant_thread_messages(
    thread_id: UUID,
    limit: int = Query(default=100, ge=1, le=200),
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if not user.shop_id:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    service = _service(db)
    from app.infrastructure.repositories.chat_repo import ChatRepository

    thread = await ChatRepository(db).get_thread(thread_id)
    if not thread or thread.shop_id != user.shop_id:
        raise HTTPException(status_code=404, detail="Thread not found")
    try:
        messages = await service.list_messages(thread_id, limit=limit)
    except ChatServiceError as exc:
        raise HTTPException(status_code=404, detail={"code": exc.code, "message": str(exc)}) from exc
    await service.mark_thread_read(thread_id, viewer_role="merchant")
    await service.touch_merchant_presence(user.shop_id)
    return {"items": [m.model_dump(mode="json") for m in messages]}


@router.post("/threads/{thread_id}/read")
async def mark_merchant_thread_read(
    thread_id: UUID,
    user: AuthUser = Depends(require_merchant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if not user.shop_id:
        raise HTTPException(status_code=403, detail="Merchant shop not found")
    from app.infrastructure.repositories.chat_repo import ChatRepository

    thread = await ChatRepository(db).get_thread(thread_id)
    if not thread or thread.shop_id != user.shop_id:
        raise HTTPException(status_code=404, detail="Thread not found")
    service = _service(db)
    try:
        await service.mark_thread_read(thread_id, viewer_role="merchant")
    except ChatServiceError as exc:
        raise HTTPException(status_code=404, detail={"code": exc.code, "message": str(exc)}) from exc
    summary = await service.thread_summary_for_role(thread_id, viewer_role="merchant")
    return {"ok": True, "thread": summary.model_dump(mode="json") if summary else None}
