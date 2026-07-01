from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.auth.jwt import create_access_token
from app.infrastructure.auth.merchant_resolve import resolve_merchant_shop
from app.infrastructure.db.models import AppUserModel
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository


async def resolve_merchant_shop_id(session: AsyncSession, user: AppUserModel) -> UUID | None:
    shop = await resolve_merchant_shop(session, user)
    if shop:
        return shop.id
    if user.telegram_id:
        repo = MarketplaceRepository(session)
        bound = await repo.get_shop_by_telegram_chat_id(int(user.telegram_id))
        if bound:
            return bound.id
    return None


def build_auth_token(
    *,
    user: AppUserModel,
    role: str,
    shop_id: UUID | None = None,
) -> str:
    return create_access_token(
        subject=str(user.id),
        role=role,
        shop_id=shop_id,
        email=user.email,
        phone=user.phone,
        telegram_id=user.telegram_id,
    )


def user_public_dict(user: AppUserModel, *, role: str, shop_id: UUID | None) -> dict:
    coins = int(getattr(user, "coins_balance", 0) or 0)
    return {
        "id": str(user.id),
        "email": user.email,
        "telegram_id": user.telegram_id,
        "phone": user.phone,
        "display_name": user.display_name,
        "role": role,
        "shop_id": str(shop_id) if shop_id else None,
        "has_email": bool(user.email),
        "has_telegram": bool(user.telegram_id),
        "coins_balance": coins,
        "coins_balance_uzs": coins * 1000,
    }
