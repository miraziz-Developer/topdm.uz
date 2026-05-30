from __future__ import annotations

import uuid
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import AppUserModel, ShopModel


class UserAuthRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, user_id: UUID) -> AppUserModel | None:
        result = await self.session.execute(select(AppUserModel).where(AppUserModel.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> AppUserModel | None:
        result = await self.session.execute(select(AppUserModel).where(AppUserModel.email == email))
        return result.scalar_one_or_none()

    async def get_by_telegram_id(self, telegram_id: int) -> AppUserModel | None:
        result = await self.session.execute(
            select(AppUserModel).where(AppUserModel.telegram_id == telegram_id)
        )
        return result.scalar_one_or_none()

    async def upsert_email_user(
        self,
        *,
        email: str,
        phone: str | None = None,
        display_name: str | None = None,
    ) -> AppUserModel:
        user = await self.get_by_email(email)
        if user:
            if phone:
                user.phone = phone
            if display_name and not user.display_name:
                user.display_name = display_name
            return user
        user = AppUserModel(
            id=uuid.uuid4(),
            email=email,
            phone=phone,
            display_name=display_name,
        )
        self.session.add(user)
        await self.session.flush()
        return user

    async def upsert_phone_user(
        self,
        *,
        phone: str,
        display_name: str | None = None,
    ) -> AppUserModel:
        result = await self.session.execute(select(AppUserModel).where(AppUserModel.phone == phone))
        user = result.scalar_one_or_none()
        if user:
            if display_name and not user.display_name:
                user.display_name = display_name
            return user
        user = AppUserModel(
            id=uuid.uuid4(),
            phone=phone,
            display_name=display_name,
        )
        self.session.add(user)
        await self.session.flush()
        return user

    async def upsert_telegram_user(
        self,
        *,
        telegram_id: int,
        display_name: str | None = None,
        phone: str | None = None,
    ) -> AppUserModel:
        user = await self.get_by_telegram_id(telegram_id)
        if user:
            if display_name:
                user.display_name = display_name
            if phone and not user.phone:
                user.phone = phone
            return user
        user = AppUserModel(
            id=uuid.uuid4(),
            telegram_id=telegram_id,
            display_name=display_name,
            phone=phone,
        )
        self.session.add(user)
        await self.session.flush()
        return user

    async def link_email(self, user: AppUserModel, email: str) -> AppUserModel:
        existing = await self.get_by_email(email)
        if existing and existing.id != user.id:
            raise ValueError("email_already_linked")
        user.email = email
        return user

    async def link_telegram(self, user: AppUserModel, telegram_id: int) -> AppUserModel:
        existing = await self.get_by_telegram_id(telegram_id)
        if existing and existing.id != user.id:
            raise ValueError("telegram_already_linked")
        user.telegram_id = telegram_id
        return user

    async def get_shop_by_owner_email(self, email: str | None) -> ShopModel | None:
        if not email:
            return None
        result = await self.session.execute(
            select(ShopModel).where(ShopModel.owner_email == email, ShopModel.is_active == True)
        )
        return result.scalar_one_or_none()
