from __future__ import annotations

import json
import time
from typing import Any
from uuid import UUID

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.email_otp import issue_and_send_email_otp
from app.application.auth.service import build_auth_token, resolve_merchant_shop_id, user_public_dict
from app.application.auth.telegram_otp import issue_and_send_telegram_otp
from app.application.marketplace.use_cases import PHONE_PATTERN
from app.core.config import get_settings
from app.infrastructure.auth.deps import AuthUser, get_current_user
from app.infrastructure.auth.merchant_resolve import resolve_merchant_shop
from app.infrastructure.auth.otp_rate_limit import (
    clear_otp_verify_failures,
    guard_otp_send,
    guard_otp_verify,
    record_otp_verify_failure,
)
from app.infrastructure.auth.telegram_verify import parse_webapp_user, verify_telegram_login
from app.infrastructure.auth.user_repo import UserAuthRepository
from app.infrastructure.messaging.resend_email import (
    ResendEmailError,
    is_valid_email,
    normalize_email,
    resend_email_gateway,
)
from app.infrastructure.messaging.telegram_otp import (
    TelegramOtpError,
    is_valid_telegram_username,
    normalize_telegram_username,
    telegram_otp_gateway,
)
from app.infrastructure.db.session import get_db_session
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository

router = APIRouter(prefix="/auth", tags=["auth"])


class EmailSendOtpRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)


class EmailVerifyOtpRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    otp: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")
    phone: str | None = None


class TelegramUsernameSendOtpRequest(BaseModel):
    telegram_username: str = Field(..., min_length=1, max_length=64)


class TelegramUsernameVerifyOtpRequest(BaseModel):
    telegram_username: str = Field(..., min_length=1, max_length=64)
    otp: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")
    phone: str | None = None


class TelegramAuthRequest(BaseModel):
    id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    auth_date: int
    hash: str

    model_config = {"extra": "allow"}


class LinkEmailSendRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)


class LinkEmailVerifyRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    otp: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class LinkTelegramRequest(BaseModel):
    id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    auth_date: int
    hash: str

    model_config = {"extra": "allow"}


class ProfilePhoneUpdate(BaseModel):
    phone: str


class TelegramWebappAuthRequest(BaseModel):
    init_data: str = Field(..., min_length=10)
    shop_id: str | None = None


class MerchantPasswordLoginRequest(BaseModel):
    login_code: str = Field(..., min_length=4, max_length=32)
    password: str = Field(..., min_length=8, max_length=128)


class MerchantShopOtpSendRequest(BaseModel):
    login_code: str = Field(..., min_length=4, max_length=32)


class MerchantShopOtpVerifyRequest(BaseModel):
    login_code: str = Field(..., min_length=4, max_length=32)
    otp: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


def _telegram_display_name(data: dict[str, Any]) -> str:
    parts = [str(data.get("first_name") or "").strip(), str(data.get("last_name") or "").strip()]
    name = " ".join(p for p in parts if p).strip()
    if name:
        return name
    username = str(data.get("username") or "").strip()
    if username:
        return f"@{username}"
    return "Telegram user"


@router.post("/email/send-otp")
async def email_send_otp(
    payload: EmailSendOtpRequest,
    request: Request,
    background_tasks: BackgroundTasks,
) -> dict:
    email = normalize_email(payload.email)
    if not is_valid_email(email):
        raise HTTPException(status_code=400, detail="Email manzil noto'g'ri")
    await guard_otp_send(request, scope="email", identity=email)
    return await issue_and_send_email_otp(email=email, background_tasks=background_tasks)


@router.post("/email/verify")
@router.post("/email/verify-otp")
async def email_verify_otp(
    payload: EmailVerifyOtpRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    email = normalize_email(payload.email)
    if not is_valid_email(email):
        raise HTTPException(status_code=400, detail="Email manzil noto'g'ri")

    phone = payload.phone.strip() if payload.phone and payload.phone.strip() else None
    if phone and not PHONE_PATTERN.match(phone):
        raise HTTPException(status_code=400, detail="Telefon +998XXXXXXXXX formatida bo'lsin")

    await guard_otp_verify(request, scope="email", identity=email)
    try:
        await resend_email_gateway.verify_otp(email=email, otp=payload.otp)
    except ResendEmailError as exc:
        await record_otp_verify_failure(scope="email", identity=email)
        raise HTTPException(status_code=400, detail=exc.message) from exc
    await clear_otp_verify_failures(scope="email", identity=email)

    repo = UserAuthRepository(db)
    user = await repo.upsert_email_user(email=email, phone=phone)
    shop_id = await resolve_merchant_shop_id(db, user)
    role = "merchant" if shop_id else "consumer"
    token = build_auth_token(user=user, role=role, shop_id=shop_id)
    await db.commit()

    return {"status": "ok", "token": token, **user_public_dict(user, role=role, shop_id=shop_id)}


@router.post("/send-otp")
async def send_otp(payload: TelegramUsernameSendOtpRequest, request: Request) -> dict:
    username = normalize_telegram_username(payload.telegram_username)
    if not is_valid_telegram_username(username):
        raise HTTPException(status_code=400, detail="Telegram username noto'g'ri (@username)")
    await guard_otp_send(request, scope="telegram", identity=username)
    return await issue_and_send_telegram_otp(telegram_username=username)


@router.post("/verify-otp")
async def verify_otp(
    payload: TelegramUsernameVerifyOtpRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    username = normalize_telegram_username(payload.telegram_username)
    if not is_valid_telegram_username(username):
        raise HTTPException(status_code=400, detail="Telegram username noto'g'ri")

    phone = payload.phone.strip() if payload.phone and payload.phone.strip() else None
    if phone and not PHONE_PATTERN.match(phone):
        raise HTTPException(status_code=400, detail="Telefon +998XXXXXXXXX formatida bo'lsin")

    await guard_otp_verify(request, scope="telegram", identity=username)
    try:
        telegram_id = await telegram_otp_gateway.verify_otp(username=username, otp=payload.otp)
    except TelegramOtpError as exc:
        await record_otp_verify_failure(scope="telegram", identity=username)
        raise HTTPException(status_code=400, detail=exc.message) from exc
    await clear_otp_verify_failures(scope="telegram", identity=username)

    repo = UserAuthRepository(db)
    user = await repo.upsert_telegram_user(
        telegram_id=telegram_id,
        display_name=f"@{username}",
        phone=phone,
    )
    shop_id = await resolve_merchant_shop_id(db, user)
    role = "merchant" if shop_id else "consumer"
    token = build_auth_token(user=user, role=role, shop_id=shop_id)
    await db.commit()

    return {"status": "ok", "token": token, **user_public_dict(user, role=role, shop_id=shop_id)}


@router.post("/telegram/webapp")
async def telegram_webapp_auth(
    payload: TelegramWebappAuthRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Issue CRM JWT from Telegram Mini App initData (opened inside merchant bot)."""
    settings = get_settings()
    if not settings.telegram_bot_token:
        raise HTTPException(status_code=503, detail="Telegram bot is not configured")

    tg_user = parse_webapp_user(payload.init_data, settings.telegram_bot_token)
    if not tg_user:
        raise HTTPException(status_code=401, detail="Telegram WebApp ma'lumoti noto'g'ri yoki muddati o'tgan")

    telegram_id = int(tg_user["id"])
    username = str(tg_user.get("username") or "").strip()
    if username:
        await telegram_otp_gateway.register_chat(telegram_id=telegram_id, username=username)

    repo = UserAuthRepository(db)
    mrepo = MarketplaceRepository(db)
    display = _telegram_display_name(
        {
            "first_name": tg_user.get("first_name"),
            "last_name": tg_user.get("last_name"),
            "username": tg_user.get("username"),
        }
    )
    user = await repo.upsert_telegram_user(telegram_id=telegram_id, display_name=display)

    shop_id: UUID | None = None
    if payload.shop_id:
        try:
            sid = UUID(payload.shop_id.strip())
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="shop_id noto'g'ri") from exc
        shop = await mrepo.get_shop(sid)
        if shop is None:
            raise HTTPException(status_code=404, detail="Do'kon topilmadi")
        bound_chat = int(shop.telegram_chat_id) if shop.telegram_chat_id else None
        if bound_chat is not None and bound_chat != telegram_id:
            raise HTTPException(status_code=403, detail="Bu do'kon boshqa Telegram chatga bog'langan")
        owned_shop_id = await resolve_merchant_shop_id(db, user)
        if owned_shop_id == shop.id:
            shop_id = shop.id
            if bound_chat is None:
                await mrepo.bind_shop_telegram_chat(shop.id, telegram_id)
        elif bound_chat == telegram_id:
            shop_id = shop.id
        else:
            raise HTTPException(
                status_code=403,
                detail="Bu do'kon sizga tegishli emas. Avval botda /register yoki /start shop_<UUID> bajaring.",
            )
    else:
        bound = await mrepo.get_shop_by_telegram_chat_id(telegram_id)
        if bound:
            shop_id = bound.id
        if shop_id is None:
            shop_id = await resolve_merchant_shop_id(db, user)

    role = "merchant" if shop_id else "consumer"
    if role != "merchant":
        raise HTTPException(
            status_code=403,
            detail="Merchant hisob topilmadi. Avval /start shop_<UUID> va kontakt ulang yoki CRM da OTP kiriting.",
        )

    token = build_auth_token(user=user, role=role, shop_id=shop_id)
    await db.commit()
    return {"status": "ok", "token": token, **user_public_dict(user, role=role, shop_id=shop_id)}


@router.post("/telegram")
async def telegram_auth(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    settings = get_settings()
    if not settings.telegram_bot_token:
        raise HTTPException(status_code=503, detail="Telegram login is not configured")

    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from exc
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    if not verify_telegram_login(body, settings.telegram_bot_token):
        raise HTTPException(
            status_code=401,
            detail=(
                "Telegram tasdiqlash yaroqsiz. BotFather → /setdomain → bozorliii.online "
                "yoki «Bot orqali kod» usulidan foydalaning."
            ),
        )

    payload = TelegramAuthRequest.model_validate(body)
    raw = body

    if payload.username:
        await telegram_otp_gateway.register_chat(telegram_id=int(payload.id), username=payload.username)

    repo = UserAuthRepository(db)
    user = await repo.upsert_telegram_user(
        telegram_id=int(payload.id),
        display_name=_telegram_display_name(raw),
    )
    shop_id = await resolve_merchant_shop_id(db, user)
    role = "merchant" if shop_id else "consumer"
    token = build_auth_token(user=user, role=role, shop_id=shop_id)
    await db.commit()

    return {"status": "ok", "token": token, **user_public_dict(user, role=role, shop_id=shop_id)}


@router.get("/me")
async def auth_me(
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    repo = UserAuthRepository(db)
    row = await repo.get_by_id(user.id)
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    shop = await resolve_merchant_shop(db, user)
    role = "merchant" if shop else user.role
    shop_dict = None
    if shop:
        from app.interfaces.api.serializers import shop_to_dict

        shop_dict = shop_to_dict(shop)
    base = user_public_dict(row, role=role, shop_id=shop.id if shop else None)
    base["shop"] = shop_dict
    return base


@router.patch("/me/phone")
async def update_phone(
    payload: ProfilePhoneUpdate,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    phone = payload.phone.strip()
    if not PHONE_PATTERN.match(phone):
        raise HTTPException(status_code=400, detail="Telefon +998XXXXXXXXX formatida bo'lsin")
    repo = UserAuthRepository(db)
    row = await repo.get_by_id(user.id)
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    row.phone = phone
    await db.flush()
    mrepo = MarketplaceRepository(db)
    linked = await mrepo.link_orders_to_user(user_id=user.id, phone=phone, email=row.email)
    await db.commit()
    return {"status": "ok", "phone": phone, "linked_orders": linked}


@router.post("/link/email/send-otp")
async def link_email_send_otp(
    payload: LinkEmailSendRequest,
    background_tasks: BackgroundTasks,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    email = normalize_email(payload.email)
    if not is_valid_email(email):
        raise HTTPException(status_code=400, detail="Email manzil noto'g'ri")

    repo = UserAuthRepository(db)
    existing = await repo.get_by_email(email)
    if existing and existing.id != user.id:
        raise HTTPException(status_code=409, detail="Email boshqa hisobda bog'langan")

    return await issue_and_send_email_otp(
        email=email,
        background_tasks=background_tasks,
        link_user_id=str(user.id),
    )


@router.post("/link/email/verify-otp")
async def link_email_verify_otp(
    payload: LinkEmailVerifyRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    email = normalize_email(payload.email)
    try:
        await resend_email_gateway.verify_otp(
            email=email,
            otp=payload.otp,
            link_user_id=str(user.id),
        )
    except ResendEmailError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc

    repo = UserAuthRepository(db)
    row = await repo.get_by_id(user.id)
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        await repo.link_email(row, email)
    except ValueError as exc:
        if str(exc) == "email_already_linked":
            raise HTTPException(status_code=409, detail="Email boshqa hisobda bog'langan") from exc
        raise
    await db.commit()
    return {"status": "ok", "email": email}


@router.post("/link/telegram")
async def link_telegram(
    payload: LinkTelegramRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    settings = get_settings()
    if not settings.telegram_bot_token:
        raise HTTPException(status_code=503, detail="Telegram login is not configured")

    raw = payload.model_dump()
    if not verify_telegram_login(raw, settings.telegram_bot_token):
        raise HTTPException(status_code=401, detail="Invalid Telegram authentication data")

    if payload.username:
        await telegram_otp_gateway.register_chat(telegram_id=int(payload.id), username=payload.username)

    repo = UserAuthRepository(db)
    row = await repo.get_by_id(user.id)
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        await repo.link_telegram(row, int(payload.id))
        if not row.display_name:
            row.display_name = _telegram_display_name(raw)
    except ValueError as exc:
        if str(exc) == "telegram_already_linked":
            raise HTTPException(status_code=409, detail="Telegram boshqa hisobda bog'langan") from exc
        raise
    await db.commit()
    return {"status": "ok", "telegram_id": int(payload.id)}


@router.post("/merchant/login")
async def merchant_password_login(
    payload: MerchantPasswordLoginRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.application.auth.merchant_login import login_merchant_with_password

    return await login_merchant_with_password(
        db,
        login_code=payload.login_code.strip().upper(),
        password=payload.password,
    )


@router.post("/merchant/send-otp")
async def merchant_shop_send_otp(
    payload: MerchantShopOtpSendRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.application.auth.merchant_login import send_merchant_shop_otp

    login_code = payload.login_code.strip().upper()
    await guard_otp_send(request, scope="merchant", identity=login_code)
    return await send_merchant_shop_otp(db, login_code=login_code)


@router.post("/merchant/verify-otp")
async def merchant_shop_verify_otp(
    payload: MerchantShopOtpVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.application.auth.merchant_login import verify_merchant_shop_otp

    login_code = payload.login_code.strip().upper()
    await guard_otp_verify(request, scope="merchant", identity=login_code)
    try:
        result = await verify_merchant_shop_otp(
            db,
            login_code=login_code,
            otp=payload.otp,
        )
    except HTTPException as exc:
        if exc.status_code == 400:
            await record_otp_verify_failure(scope="merchant", identity=login_code)
        raise
    await clear_otp_verify_failures(scope="merchant", identity=login_code)
    return result


# ─── Google OAuth ────────────────────────────────────────────────────────────

class GoogleAuthRequest(BaseModel):
    id_token: str = Field(..., min_length=10)


@router.post("/google")
async def google_auth(
    payload: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Google id_token ni tekshirib, JWT qaytaradi."""
    settings = get_settings()
    client_id = settings.google_oauth_client_id
    if not client_id:
        raise HTTPException(status_code=503, detail="Google OAuth sozlanmagan")

    # Google tokeninfo endpoint orqali tekshirish (google-auth paketi o'rniga httpx)
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": payload.id_token},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Google token yaroqsiz")

    info = resp.json()
    # Audience tekshiruvi
    aud = info.get("aud", "")
    if aud not in (client_id, f"{client_id}.apps.googleusercontent.com"):
        raise HTTPException(status_code=401, detail="Google token audience noto'g'ri")
    # Muddati tekshiruvi
    exp = int(info.get("exp", 0))
    if exp and time.time() > exp:
        raise HTTPException(status_code=401, detail="Google token muddati tugagan")

    email = (info.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Google hisobda email topilmadi")

    display_name = (info.get("name") or "").strip() or None

    repo = UserAuthRepository(db)
    user = await repo.upsert_email_user(email=email, display_name=display_name)
    shop_id = await resolve_merchant_shop_id(db, user)
    role = "merchant" if shop_id else "consumer"
    token = build_auth_token(user=user, role=role, shop_id=shop_id)
    await db.commit()

    return {"status": "ok", "token": token, **user_public_dict(user, role=role, shop_id=shop_id)}


# ─── Apple OAuth ─────────────────────────────────────────────────────────────

class AppleAuthUser(BaseModel):
    name: str | None = None
    email: str | None = None


class AppleAuthRequest(BaseModel):
    identity_token: str = Field(..., min_length=10)
    user: AppleAuthUser | None = None


@router.post("/apple")
async def apple_auth(
    payload: AppleAuthRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Apple identity_token ni tekshirib, JWT qaytaradi."""
    settings = get_settings()
    apple_client_id = settings.apple_client_id
    if not apple_client_id:
        raise HTTPException(status_code=503, detail="Apple Sign In sozlanmagan")

    # Apple public keys olish
    async with httpx.AsyncClient(timeout=10) as client:
        keys_resp = await client.get("https://appleid.apple.com/auth/keys")
    if keys_resp.status_code != 200:
        raise HTTPException(status_code=503, detail="Apple public keys olinmadi")

    # JWT header dan kid olish
    try:
        header_part = payload.identity_token.split(".")[0]
        # Base64 padding
        padding = 4 - len(header_part) % 4
        if padding != 4:
            header_part += "=" * padding
        import base64
        header = json.loads(base64.urlsafe_b64decode(header_part))
        kid = header.get("kid")
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Apple token formati noto'g'ri") from exc

    # Matching key topish
    keys_data = keys_resp.json()
    matching_key = None
    for k in keys_data.get("keys", []):
        if k.get("kid") == kid:
            matching_key = k
            break
    if not matching_key:
        raise HTTPException(status_code=401, detail="Apple token kaliti topilmadi")

    # JWT ni jose bilan tekshirish
    try:
        from jose import jwt as jose_jwt
        from jose.backends import RSAKey
        import json as _json

        rsa_key = RSAKey(key=matching_key, algorithm="RS256")
        claims = jose_jwt.decode(
            payload.identity_token,
            rsa_key.public_key().to_dict(),
            algorithms=["RS256"],
            audience=apple_client_id,
            issuer="https://appleid.apple.com",
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Apple token tekshiruvi muvaffaqiyatsiz: {exc}") from exc

    # Email olish (birinchi logindan keyin Apple email bermaydi)
    email = (claims.get("email") or "").strip().lower()
    if not email and payload.user and payload.user.email:
        email = payload.user.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Apple hisobdan email olinmadi")

    display_name = None
    if payload.user and payload.user.name:
        display_name = payload.user.name.strip() or None

    repo = UserAuthRepository(db)
    user = await repo.upsert_email_user(email=email, display_name=display_name)
    shop_id = await resolve_merchant_shop_id(db, user)
    role = "merchant" if shop_id else "consumer"
    token = build_auth_token(user=user, role=role, shop_id=shop_id)
    await db.commit()

    return {"status": "ok", "token": token, **user_public_dict(user, role=role, shop_id=shop_id)}
