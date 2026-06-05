from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

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

    async def update_description(self, shop_id: UUID, *, description: str | None) -> dict:
        shop = await self._repo.get_shop(shop_id)
        if not shop:
            raise ShopBrandingError("not_found", "Do'kon topilmadi")
        text = (description or "").strip()
        shop.description = text[:2000] if text else None
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
