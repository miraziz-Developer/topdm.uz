from __future__ import annotations

from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.infrastructure.auth.jwt import decode_access_token
from app.infrastructure.auth.merchant_resolve import resolve_merchant_shop
from app.infrastructure.auth.types import AuthUser
from app.infrastructure.auth.user_repo import UserAuthRepository
from app.infrastructure.db.session import get_db_session

__all__ = ["AuthUser", "get_current_user", "get_optional_user", "require_merchant", "require_merchant_shop"]

bearer_scheme = HTTPBearer(auto_error=False)

def _session_cookie_name() -> str:
    return get_settings().session_cookie_name or "bozor_session"


def _token_from_request(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
) -> str | None:
    if credentials is not None and credentials.scheme.lower() == "bearer":
        token = (credentials.credentials or "").strip()
        if len(token) >= 20:
            return token
    cookie_token = (request.cookies.get(_session_cookie_name()) or "").strip()
    if len(cookie_token) >= 20:
        return cookie_token
    return None


async def _user_from_payload(payload: dict, session: AsyncSession) -> AuthUser:
    sub = str(payload.get("sub") or "").strip()
    repo = UserAuthRepository(session)

    user_row = None
    if sub:
        try:
            user_row = await repo.get_by_id(UUID(sub))
        except ValueError:
            user_row = None
    if user_row is None and "@" in sub:
        user_row = await repo.get_by_email(sub.lower())

    if user_row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    shop_id_raw = payload.get("shop_id")
    shop_id = UUID(str(shop_id_raw)) if shop_id_raw else None
    return AuthUser(
        id=user_row.id,
        email=user_row.email,
        telegram_id=user_row.telegram_id,
        phone=user_row.phone,
        display_name=user_row.display_name,
        role=str(payload.get("role") or "consumer"),
        shop_id=shop_id,
    )


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db_session),
) -> AuthUser:
    token = _token_from_request(request, credentials)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        payload = decode_access_token(token)
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc
    return await _user_from_payload(payload, db)


async def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db_session),
) -> AuthUser | None:
    token = _token_from_request(request, credentials)
    if not token:
        return None
    try:
        payload = decode_access_token(token)
    except JWTError:
        return None
    try:
        return await _user_from_payload(payload, db)
    except HTTPException:
        return None


async def require_merchant(
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> AuthUser:
    shop = await resolve_merchant_shop(db, user)
    if not shop:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Merchant shop not found")
    user.shop_id = shop.id
    user.role = "merchant"
    return user


async def require_merchant_shop(
    user: AuthUser = Depends(require_merchant),
) -> UUID:
    """Billing endpoints uchun — faqat shop_id qaytaradi."""
    if not user.shop_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Shop not found")
    return user.shop_id
