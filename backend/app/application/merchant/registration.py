from __future__ import annotations

import re
import secrets
import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.merchant.password import hash_password
from app.core.config import get_settings
from app.core.slug import slugify, unique_slug
from app.infrastructure.db.models import MerchantCredentialModel, ShopModel
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.infrastructure.storage.telegram_media import TelegramMediaStore

MARKET_ZONE_OPTIONS = (
    "Ippodrom",
    "Chorsu",
    "Oloy",
    "G'uncha",
    "Yangi hayot",
    "Boshqa",
)

_PHONE_RE = re.compile(r"^\+998\d{9}$")


@dataclass(slots=True)
class MerchantRegistrationDraft:
    name: str
    market_zone: str
    block_sector: str
    stall_number: str
    location_comment: str
    latitude: float
    longitude: float
    location_accuracy: float | None
    owner_phone: str
    owner_display_name: str | None
    storefront_file_id: str | None
    storefront_image_url: str | None
    telegram_chat_id: int
    telegram_user_id: int | None


@dataclass(slots=True)
class MerchantRegistrationResult:
    shop: ShopModel
    login_code: str
    password_plain: str


def normalize_uz_phone(raw: str) -> str | None:
    digits = "".join(c for c in raw if c.isdigit())
    if len(digits) == 9:
        return f"+998{digits}"
    if len(digits) == 12 and digits.startswith("998"):
        return f"+{digits}"
    if _PHONE_RE.match(raw.strip()):
        return raw.strip()
    return None


def generate_login_code(shop_name: str) -> str:
    base = slugify(shop_name).replace("-", "")[:8].upper() or "SHOP"
    suffix = secrets.token_hex(2).upper()
    return f"{base}-{suffix}"


def generate_password(length: int = 10) -> str:
    alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))


class MerchantRegistrationService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = MarketplaceRepository(session)

    async def phone_already_registered(self, phone: str) -> bool:
        existing = await self._repo.get_shop_by_owner_phone(phone)
        return existing is not None

    async def chat_already_has_shop(self, telegram_chat_id: int) -> ShopModel | None:
        return await self._repo.get_shop_by_telegram_chat_id(telegram_chat_id)

    async def register_shop(self, draft: MerchantRegistrationDraft) -> MerchantRegistrationResult:
        phone = normalize_uz_phone(draft.owner_phone)
        if not phone:
            raise ValueError("Telefon +998XXXXXXXXX formatida bo'lishi kerak")
        if await self.phone_already_registered(phone):
            raise ValueError("Bu telefon allaqachon ro'yxatdan o'tgan")

        existing_slugs = {
            row[0]
            for row in (
                await self._session.execute(select(ShopModel.slug))
            ).all()
        }
        slug = unique_slug(draft.name, set(existing_slugs))
        floor = draft.market_zone
        section = f"{draft.block_sector} · {draft.stall_number}".strip(" · ")

        shop = await self._repo.create_shop(
            name=draft.name.strip(),
            slug=slug,
            owner_phone=phone,
            market_zone=draft.market_zone,
            block_sector=draft.block_sector.strip(),
            stall_number=draft.stall_number.strip(),
            floor=floor,
            section=section,
            location_comment=draft.location_comment.strip(),
            latitude=draft.latitude,
            longitude=draft.longitude,
            location_accuracy=draft.location_accuracy,
            logo_url=None,
            storefront_image_url=None,
            owner_display_name=draft.owner_display_name,
            registration_source="telegram",
            telegram_chat_id=draft.telegram_chat_id,
            is_verified=False,
        )

        if draft.storefront_file_id:
            media = TelegramMediaStore()
            settings = get_settings()
            placeholder = f"{settings.site_url.rstrip('/')}/placeholder.svg"
            try:
                url = await media.resolve_permanent_url(
                    shop_id=shop.id,
                    telegram_file_id=draft.storefront_file_id,
                    fallback_placeholder=placeholder,
                )
                shop.logo_url = url
                shop.storefront_image_url = url
                await self._session.commit()
                await self._session.refresh(shop)
            except Exception:
                pass

        login_code = await self._unique_login_code(draft.name)
        password_plain = generate_password()
        cred = MerchantCredentialModel(
            shop_id=shop.id,
            login_code=login_code,
            password_hash=hash_password(password_plain),
        )
        self._session.add(cred)
        await self._session.commit()
        await self._session.refresh(shop)
        return MerchantRegistrationResult(shop=shop, login_code=login_code, password_plain=password_plain)

    async def _unique_login_code(self, shop_name: str) -> str:
        for _ in range(12):
            code = generate_login_code(shop_name)
            exists = await self._session.execute(
                select(MerchantCredentialModel.id).where(MerchantCredentialModel.login_code == code)
            )
            if exists.scalar_one_or_none() is None:
                return code
        return generate_login_code(shop_name) + secrets.token_hex(1).upper()
