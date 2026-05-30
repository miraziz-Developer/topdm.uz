from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.auth.types import AuthUser
from app.infrastructure.auth.user_repo import UserAuthRepository
from app.infrastructure.db.models import AppUserModel, ShopModel
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository


async def resolve_merchant_shop(session: AsyncSession, user: AuthUser | AppUserModel) -> ShopModel | None:
    repo = MarketplaceRepository(session)
    auth_repo = UserAuthRepository(session)

    shop_id = user.shop_id if isinstance(user, AuthUser) else None
    email = user.email
    phone = user.phone

    if isinstance(user, AuthUser) and user.shop_id:
        shop = await repo.get_shop(user.shop_id)
        if shop:
            return shop

    if email:
        shop = await auth_repo.get_shop_by_owner_email(email)
        if shop:
            return shop

    if phone:
        return await repo.get_shop_by_owner_phone(phone)

    return None


async def customer_phone_for_user(session: AsyncSession, user: AuthUser) -> str | None:
    if user.phone:
        return user.phone
    auth_repo = UserAuthRepository(session)
    row = await auth_repo.get_by_id(user.id)
    return row.phone if row else None
