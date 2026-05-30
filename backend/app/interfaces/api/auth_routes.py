from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.email_otp import issue_and_send_email_otp
from app.application.auth.service import build_auth_token, resolve_merchant_shop_id, user_public_dict
from app.application.auth.telegram_otp import issue_and_send_telegram_otp
from app.application.marketplace.use_cases import PHONE_PATTERN
from app.core.config import get_settings
from app.infrastructure.auth.deps import AuthUser, get_current_user
from app.infrastructure.auth.merchant_resolve import resolve_merchant_shop
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
    otp: str = Field(..., min_length=4, max_length=6)
    phone: str | None = None


class TelegramUsernameSendOtpRequest(BaseModel):
    telegram_username: str = Field(..., min_length=1, max_length=64)


class TelegramUsernameVerifyOtpRequest(BaseModel):
    telegram_username: str = Field(..., min_length=1, max_length=64)
    otp: str = Field(..., min_length=4, max_length=6)
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
    otp: str = Field(..., min_length=4, max_length=6)


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
    password: str = Field(..., min_length=4, max_length=128)


class MerchantShopOtpSendRequest(BaseModel):
    login_code: str = Field(..., min_length=4, max_length=32)


class MerchantShopOtpVerifyRequest(BaseModel):
    login_code: str = Field(..., min_length=4, max_length=32)
    otp: str = Field(..., min_length=4, max_length=6)


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
    background_tasks: BackgroundTasks,
) -> dict:
    email = normalize_email(payload.email)
    if not is_valid_email(email):
        raise HTTPException(status_code=400, detail="Email manzil noto'g'ri")
    return await issue_and_send_email_otp(email=email, background_tasks=background_tasks)


@router.post("/email/verify")
@router.post("/email/verify-otp")
async def email_verify_otp(
    payload: EmailVerifyOtpRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    email = normalize_email(payload.email)
    if not is_valid_email(email):
        raise HTTPException(status_code=400, detail="Email manzil noto'g'ri")

    phone = payload.phone.strip() if payload.phone and payload.phone.strip() else None
    if phone and not PHONE_PATTERN.match(phone):
        raise HTTPException(status_code=400, detail="Telefon +998XXXXXXXXX formatida bo'lsin")

    try:
        await resend_email_gateway.verify_otp(email=email, otp=payload.otp)
    except ResendEmailError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc

    repo = UserAuthRepository(db)
    user = await repo.upsert_email_user(email=email, phone=phone)
    shop_id = await resolve_merchant_shop_id(db, user)
    role = "merchant" if shop_id else "consumer"
    token = build_auth_token(user=user, role=role, shop_id=shop_id)
    await db.commit()

    return {"status": "ok", "token": token, **user_public_dict(user, role=role, shop_id=shop_id)}


@router.post("/send-otp")
async def send_otp(payload: TelegramUsernameSendOtpRequest) -> dict:
    username = normalize_telegram_username(payload.telegram_username)
    if not is_valid_telegram_username(username):
        raise HTTPException(status_code=400, detail="Telegram username noto'g'ri (@username)")
    return await issue_and_send_telegram_otp(telegram_username=username)


@router.post("/verify-otp")
async def verify_otp(
    payload: TelegramUsernameVerifyOtpRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    username = normalize_telegram_username(payload.telegram_username)
    if not is_valid_telegram_username(username):
        raise HTTPException(status_code=400, detail="Telegram username noto'g'ri")

    phone = payload.phone.strip() if payload.phone and payload.phone.strip() else None
    if phone and not PHONE_PATTERN.match(phone):
        raise HTTPException(status_code=400, detail="Telefon +998XXXXXXXXX formatida bo'lsin")

    try:
        telegram_id = await telegram_otp_gateway.verify_otp(username=username, otp=payload.otp)
    except TelegramOtpError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc

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
        shop_id = shop.id
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
async def telegram_auth(payload: TelegramAuthRequest, db: AsyncSession = Depends(get_db_session)) -> dict:
    settings = get_settings()
    if not settings.telegram_bot_token:
        raise HTTPException(status_code=503, detail="Telegram login is not configured")

    raw = payload.model_dump()
    if not verify_telegram_login(raw, settings.telegram_bot_token):
        raise HTTPException(status_code=401, detail="Invalid Telegram authentication data")

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
    await db.commit()
    return {"status": "ok", "phone": phone}


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
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.application.auth.merchant_login import send_merchant_shop_otp

    return await send_merchant_shop_otp(db, login_code=payload.login_code.strip().upper())


@router.post("/merchant/verify-otp")
async def merchant_shop_verify_otp(
    payload: MerchantShopOtpVerifyRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.application.auth.merchant_login import verify_merchant_shop_otp

    return await verify_merchant_shop_otp(
        db,
        login_code=payload.login_code.strip().upper(),
        otp=payload.otp,
    )
