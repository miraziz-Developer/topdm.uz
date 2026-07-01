from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.db.models import ChatMessageModel, ChatThreadModel


class ChatRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_or_create_thread(
        self,
        *,
        shop_id: UUID,
        customer_key: str,
        customer_display_name: str | None = None,
    ) -> ChatThreadModel:
        result = await self._session.execute(
            select(ChatThreadModel).where(
                ChatThreadModel.shop_id == shop_id,
                ChatThreadModel.customer_key == customer_key,
            )
        )
        row = result.scalar_one_or_none()
        if row:
            return row
        row = ChatThreadModel(
            shop_id=shop_id,
            customer_key=customer_key,
            customer_display_name=customer_display_name,
            status="open",
        )
        self._session.add(row)
        await self._session.flush()
        return row

    async def get_thread(self, thread_id: UUID) -> ChatThreadModel | None:
        result = await self._session.execute(select(ChatThreadModel).where(ChatThreadModel.id == thread_id))
        return result.scalar_one_or_none()

    async def list_threads_for_shop(self, shop_id: UUID, *, limit: int = 50) -> list[ChatThreadModel]:
        result = await self._session.execute(
            select(ChatThreadModel)
            .where(ChatThreadModel.shop_id == shop_id, ChatThreadModel.status == "open")
            .order_by(desc(ChatThreadModel.updated_at), desc(ChatThreadModel.created_at))
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_last_message_preview(self, thread_id: UUID) -> ChatMessageModel | None:
        result = await self._session.execute(
            select(ChatMessageModel)
            .where(ChatMessageModel.thread_id == thread_id)
            .order_by(desc(ChatMessageModel.created_at))
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_thread_with_shop(self, thread_id: UUID) -> ChatThreadModel | None:
        result = await self._session.execute(
            select(ChatThreadModel).where(ChatThreadModel.id == thread_id).options(selectinload(ChatThreadModel.messages))
        )
        return result.scalar_one_or_none()

    async def list_messages(self, thread_id: UUID, *, limit: int = 100, before_id: UUID | None = None) -> list[ChatMessageModel]:
        stmt = (
            select(ChatMessageModel)
            .where(ChatMessageModel.thread_id == thread_id)
            .order_by(ChatMessageModel.created_at.asc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def add_message(
        self,
        *,
        thread_id: UUID,
        sender_role: str,
        body: str,
        metadata: dict | None = None,
    ) -> ChatMessageModel:
        msg = ChatMessageModel(
            thread_id=thread_id,
            sender_role=sender_role,
            body=body.strip(),
            message_metadata=metadata or {},
        )
        self._session.add(msg)
        thread = await self.get_thread(thread_id)
        if thread:
            thread.updated_at = datetime.now(timezone.utc)
        await self._session.flush()
        return msg

    async def count_unread_for_role(self, thread_id: UUID, *, viewer_role: str) -> int:
        thread = await self.get_thread(thread_id)
        if not thread:
            return 0
        sender_role = "customer" if viewer_role == "merchant" else "merchant"
        stmt = select(func.count()).select_from(ChatMessageModel).where(
            ChatMessageModel.thread_id == thread_id,
            ChatMessageModel.sender_role == sender_role,
        )
        last_read = thread.merchant_last_read_at if viewer_role == "merchant" else thread.customer_last_read_at
        if last_read is not None:
            stmt = stmt.where(ChatMessageModel.created_at > last_read)
        result = await self._session.execute(stmt)
        return int(result.scalar_one() or 0)

    async def mark_read_for_role(self, thread_id: UUID, *, viewer_role: str) -> None:
        thread = await self.get_thread(thread_id)
        if not thread:
            return
        now = datetime.now(timezone.utc)
        if viewer_role == "merchant":
            thread.merchant_last_read_at = now
        else:
            thread.customer_last_read_at = now
        await self._session.flush()
