from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.merchant.wholesale_pack import normalize_shop_type
from app.core.phone import normalize_uz_phone_e164
from app.infrastructure.auth.user_repo import UserAuthRepository
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.infrastructure.storage.object_store import ObjectMediaStore
from app.interfaces.api.serializers import shop_to_dict


class ShopBrandingError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


def _extension_from_content_type(content_type: str) -> str:
    ct = (content_type or "").lower()
    if "png" in ct:
        return "png"
    if "webp" in ct:
        return "webp"
    if "gif" in ct:
        return "gif"
    return "jpg"


class MerchantShopBrandingService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = MarketplaceRepository(session)
        self._media = ObjectMediaStore()

    async def get_profile(self, shop_id: UUID) -> dict:
        shop = await self._repo.get_shop(shop_id)
        if not shop:
            raise ShopBrandingError("not_found", "Do'kon topilmadi")
        return shop_to_dict(shop)

    async def update_profile(
        self,
        shop_id: UUID,
        *,
        user_id: UUID | None = None,
        **fields: Any,
    ) -> dict:
        shop = await self._repo.get_shop(shop_id)
        if not shop:
            raise ShopBrandingError("not_found", "Do'kon topilmadi")

        if "name" in fields:
            text = (fields["name"] or "").strip()
            if len(text) < 2:
                raise ShopBrandingError("invalid_name", "Do'kon nomi kamida 2 ta belgi bo'lsin")
            shop.name = text[:200]

        if "description" in fields:
            text = (fields["description"] or "").strip()
            shop.description = text[:2000] if text else None

        if "owner_display_name" in fields:
            text = (fields["owner_display_name"] or "").strip()
            shop.owner_display_name = text[:120] if text else None

        if "shop_type" in fields:
            shop.shop_type = normalize_shop_type(fields["shop_type"])

        if "owner_phone" in fields:
            normalized = normalize_uz_phone_e164(fields["owner_phone"])
            if not normalized:
                raise ShopBrandingError(
                    "invalid_phone",
                    "Telefon +998XXXXXXXXX formatida bo'lishi kerak",
                )
            current = normalize_uz_phone_e164(shop.owner_phone) or shop.owner_phone
            if normalized != current:
                taken = await self._repo.get_shop_by_owner_phone(normalized)
                if taken and taken.id != shop.id:
                    raise ShopBrandingError(
                        "phone_taken",
                        "Bu telefon boshqa do'konda ro'yxatdan o'tgan",
                    )
                shop.owner_phone = normalized
                if user_id:
                    auth_repo = UserAuthRepository(self._session)
                    user = await auth_repo.get_by_id(user_id)
                    if user:
                        user.phone = normalized

        await self._session.commit()
        await self._session.refresh(shop)
        return shop_to_dict(shop)

    async def upload_logo(
        self,
        shop_id: UUID,
        *,
        image_bytes: bytes,
        content_type: str,
    ) -> dict:
        if not image_bytes:
            raise ShopBrandingError("image_required", "Logo rasmini yuklang")
        shop = await self._repo.get_shop(shop_id)
        if not shop:
            raise ShopBrandingError("not_found", "Do'kon topilmadi")
        ext = _extension_from_content_type(content_type)
        url = await self._media.save_shop_image(
            shop_id=shop_id,
            image_bytes=image_bytes,
            extension=ext,
            content_type=content_type,
            kind="logo",
        )
        shop.logo_url = url
        await self._session.commit()
        await self._session.refresh(shop)
        return shop_to_dict(shop)

    async def upload_storefront(
        self,
        shop_id: UUID,
        *,
        image_bytes: bytes,
        content_type: str,
    ) -> dict:
        if not image_bytes:
            raise ShopBrandingError("image_required", "Muqova rasmini yuklang")
        shop = await self._repo.get_shop(shop_id)
        if not shop:
            raise ShopBrandingError("not_found", "Do'kon topilmadi")
        ext = _extension_from_content_type(content_type)
        url = await self._media.save_shop_image(
            shop_id=shop_id,
            image_bytes=image_bytes,
            extension=ext,
            content_type=content_type,
            kind="cover",
        )
        shop.storefront_image_url = url
        await self._session.commit()
        await self._session.refresh(shop)
        return shop_to_dict(shop)
