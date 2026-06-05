from __future__ import annotations

from uuid import UUID

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.merchant.schemas import ChatMessageItem, ChatThreadItem, ChatThreadSummary
from app.core.config import get_settings
from app.domain.interfaces.notifier_gateway import NotifierGateway
from app.infrastructure.cache.chat_pubsub import ChatPubSubGateway, chat_channel
from app.infrastructure.repositories.chat_repo import ChatRepository
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository


class ChatServiceError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


class MerchantChatService:
    def __init__(
        self,
        session: AsyncSession,
        *,
        notifier: NotifierGateway | None = None,
        pubsub: ChatPubSubGateway | None = None,
    ) -> None:
        self._session = session
        self._chat = ChatRepository(session)
        self._shops = MarketplaceRepository(session)
        self._notifier = notifier
        self._pubsub = pubsub or ChatPubSubGateway()
        self._settings = get_settings()

    async def open_thread(
        self,
        *,
        shop_id: UUID,
        customer_key: str,
        customer_display_name: str | None = None,
    ) -> ChatThreadItem:
        shop = await self._shops.get_shop(shop_id)
        if not shop or not shop.is_active:
            raise ChatServiceError("shop_not_found", "Shop not found")
        thread = await self._chat.get_or_create_thread(
            shop_id=shop_id,
            customer_key=customer_key.strip(),
            customer_display_name=customer_display_name,
        )
        await self._session.commit()
        return self._thread_item(thread)

    async def list_shop_threads(self, shop_id: UUID, *, limit: int = 50) -> list[ChatThreadSummary]:
        rows = await self._chat.list_threads_for_shop(shop_id, limit=limit)
        summaries: list[ChatThreadSummary] = []
        for row in rows:
            preview = await self._chat.get_last_message_preview(row.id)
            summaries.append(
                ChatThreadSummary(
                    id=row.id,
                    shop_id=row.shop_id,
                    customer_key=row.customer_key,
                    customer_display_name=row.customer_display_name,
                    status=row.status,
                    updated_at=row.updated_at,
                    last_message=preview.body[:200] if preview else None,
                    last_sender_role=preview.sender_role if preview else None,
                )
            )
        return summaries

    async def list_messages(self, thread_id: UUID, *, limit: int = 100) -> list[ChatMessageItem]:
        thread = await self._chat.get_thread(thread_id)
        if not thread:
            raise ChatServiceError("not_found", "Thread not found")
        rows = await self._chat.list_messages(thread_id, limit=limit)
        return [self._message_item(m) for m in rows]

    async def send_message(
        self,
        thread_id: UUID,
        *,
        sender_role: str,
        body: str,
        metadata: dict | None = None,
    ) -> ChatMessageItem:
        if sender_role not in {"customer", "merchant", "system"}:
            raise ChatServiceError("invalid_role", "Invalid sender role")
        cleaned = body.strip()
        if not cleaned:
            raise ChatServiceError("empty_body", "Message body is required")

        thread = await self._chat.get_thread(thread_id)
        if not thread:
            raise ChatServiceError("not_found", "Thread not found")

        msg = await self._chat.add_message(
            thread_id=thread_id,
            sender_role=sender_role,
            body=cleaned,
            metadata=metadata,
        )
        await self._session.commit()

        item = self._message_item(msg)
        try:
            await self._pubsub.publish_message(
                str(thread_id),
                {"type": "message", **item.model_dump(mode="json")},
            )
        except Exception:
            logger.warning("chat_pubsub_publish_failed", thread_id=str(thread_id))

        if sender_role == "customer":
            await self._forward_to_telegram_if_offline(thread.shop_id, thread, item)

        return item

    async def touch_merchant_presence(self, shop_id: UUID) -> None:
        await self._pubsub.set_merchant_online(str(shop_id))

    async def _forward_to_telegram_if_offline(self, shop_id: UUID, thread, message: ChatMessageItem) -> None:
        if await self._pubsub.is_merchant_online(str(shop_id)):
            return
        if not self._notifier:
            return
        shop = await self._shops.get_shop(shop_id)
        if not shop or not shop.telegram_chat_id:
            return
        label = thread.customer_display_name or thread.customer_key
        text = (
            f"Yangi xabar (CRM offline)\n"
            f"Mijoz: {label}\n"
            f"Xabar: {message.body[:500]}"
        )
        try:
            from app.application.merchant.telegram_crm_notify import notify_merchant_telegram

            await notify_merchant_telegram(
                self._notifier,
                chat_id=int(shop.telegram_chat_id),
                text=text,
                shop_id=shop_id,
                crm_next="/dashboard/chat",
            )
        except Exception:
            logger.warning("chat_telegram_forward_failed", shop_id=str(shop_id))

    @staticmethod
    def _thread_item(row) -> ChatThreadItem:
        return ChatThreadItem(
            id=row.id,
            shop_id=row.shop_id,
            customer_key=row.customer_key,
            customer_display_name=row.customer_display_name,
            status=row.status,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    @staticmethod
    def _message_item(row) -> ChatMessageItem:
        return ChatMessageItem(
            id=row.id,
            thread_id=row.thread_id,
            sender_role=row.sender_role,
            body=row.body,
            created_at=row.created_at,
            metadata=dict(row.message_metadata or {}),
        )
