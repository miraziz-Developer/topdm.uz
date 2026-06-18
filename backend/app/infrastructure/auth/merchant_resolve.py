from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.phone import normalize_uz_phone_e164
from app.infrastructure.auth.types import AuthUser
from app.infrastructure.auth.user_repo import UserAuthRepository
from app.infrastructure.db.models import AppUserModel, ShopModel
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository


async def resolve_merchant_shop(session: AsyncSession, user: AuthUser | AppUserModel) -> ShopModel | None:
    repo = MarketplaceRepository(session)
    auth_repo = UserAuthRepository(session)

    email = (user.email or "").strip().lower() if user.email else None
    phone = user.phone

    if email:
        shop = await auth_repo.get_shop_by_owner_email(email)
        if shop:
            return shop

    if phone:
        shop = await repo.get_shop_by_owner_phone(phone)
        if shop:
            return shop

    if isinstance(user, AuthUser) and user.shop_id:
        shop = await repo.get_shop(user.shop_id)
        if not shop:
            return None
        owner_email = (shop.owner_email or "").strip().lower()
        if email and owner_email and owner_email != email:
            return None
        if phone:
            normalized = normalize_uz_phone_e164(phone)
            owner_phone = normalize_uz_phone_e164(shop.owner_phone) or shop.owner_phone
            if normalized and owner_phone and normalized != owner_phone:
                return None
        return shop

    return None


async def customer_phone_for_user(session: AsyncSession, user: AuthUser) -> str | None:
    if user.phone:
        return normalize_uz_phone_e164(user.phone) or user.phone.strip()
    auth_repo = UserAuthRepository(session)
    row = await auth_repo.get_by_id(user.id)
    if not row or not row.phone:
        return None
    return normalize_uz_phone_e164(row.phone) or row.phone.strip()


async def customer_account_for_user(
    session: AsyncSession,
    user: AuthUser,
) -> tuple[UUID, str | None, str | None]:
    """User id + normalized phone + email for order lookups."""
    auth_repo = UserAuthRepository(session)
    row = await auth_repo.get_by_id(user.id)
    phone_raw = (row.phone if row and row.phone else user.phone) or None
    email_raw = (row.email if row and row.email else user.email) or None
    phone = normalize_uz_phone_e164(phone_raw) if phone_raw else None
    email = email_raw.strip().lower() if email_raw and email_raw.strip() else None
    return user.id, phone, email
