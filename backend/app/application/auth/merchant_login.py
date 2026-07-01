from __future__ import annotations

import random

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.service import build_auth_token, user_public_dict
from app.application.merchant.password import verify_password
from app.core.config import get_settings
from app.infrastructure.auth.user_repo import UserAuthRepository
from app.infrastructure.db.models import ShopModel
from app.infrastructure.messaging.telegram_otp import BotNotStartedError, TelegramOtpError, telegram_otp_gateway
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository


async def login_merchant_with_password(
    session: AsyncSession,
    *,
    login_code: str,
    password: str,
) -> dict:
    repo = MarketplaceRepository(session)
    cred = await repo.get_merchant_credential_by_login_code(login_code)
    if cred is None or not verify_password(password, cred.password_hash):
        raise HTTPException(status_code=401, detail="Login yoki parol noto'g'ri")

    shop = await repo.get_shop(cred.shop_id)
    if shop is None or not shop.is_active:
        raise HTTPException(status_code=403, detail="Do'kon faol emas")

    owner_phone = (shop.owner_phone or "").strip()
    if not owner_phone:
        raise HTTPException(status_code=400, detail="Do'kon telefoni topilmadi — bot orqali ro'yxatdan o'ting")

    auth_repo = UserAuthRepository(session)
    try:
        user = await auth_repo.upsert_phone_user(
            phone=owner_phone,
            display_name=shop.owner_display_name or shop.name,
        )
    except ValueError as exc:
        if str(exc) == "phone_required":
            raise HTTPException(status_code=400, detail="Do'kon telefoni topilmadi") from exc
        raise
    token = build_auth_token(user=user, role="merchant", shop_id=shop.id)
    await session.commit()
    return {"status": "ok", "token": token, **user_public_dict(user, role="merchant", shop_id=shop.id)}


async def send_merchant_shop_otp(session: AsyncSession, *, login_code: str) -> dict:
    settings = get_settings()
    repo = MarketplaceRepository(session)
    cred = await repo.get_merchant_credential_by_login_code(login_code)
    if cred is None:
        raise HTTPException(status_code=404, detail="Do'kon login kodi topilmadi")
    shop = await repo.get_shop(cred.shop_id)
    if shop is None:
        raise HTTPException(status_code=404, detail="Do'kon topilmadi")
    if not shop.telegram_chat_id:
        raise HTTPException(
            status_code=400,
            detail="Avval merchant botda /start bosing va ro'yxatdan o'ting",
        )

    otp = f"{random.randint(100000, 999999)}"
    try:
        await telegram_otp_gateway.send_otp_to_chat(chat_id=int(shop.telegram_chat_id), otp=otp)
    except BotNotStartedError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc
    except TelegramOtpError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc

    payload: dict = {"status": "ok", "login_code": cred.login_code, "delivery": "telegram"}
    if settings.app_debug:
        payload["dev_otp"] = otp
    return payload


async def verify_merchant_shop_otp(
    session: AsyncSession,
    *,
    login_code: str,
    otp: str,
) -> dict:
    repo = MarketplaceRepository(session)
    cred = await repo.get_merchant_credential_by_login_code(login_code)
    if cred is None:
        raise HTTPException(status_code=404, detail="Do'kon login kodi topilmadi")
    shop = await repo.get_shop(cred.shop_id)
    if shop is None or not shop.telegram_chat_id:
        raise HTTPException(status_code=400, detail="Do'kon bot bilan ulanmagan")

    try:
        telegram_id = await telegram_otp_gateway.verify_otp_for_chat(
            chat_id=int(shop.telegram_chat_id),
            otp=otp.strip(),
        )
    except TelegramOtpError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc

    auth_repo = UserAuthRepository(session)
    user = await auth_repo.upsert_telegram_user(
        telegram_id=telegram_id,
        display_name=shop.owner_display_name or shop.name,
        phone=shop.owner_phone,
    )
    token = build_auth_token(user=user, role="merchant", shop_id=shop.id)
    await session.commit()
    return {"status": "ok", "token": token, **user_public_dict(user, role="merchant", shop_id=shop.id)}
