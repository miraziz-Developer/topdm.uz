from __future__ import annotations

from uuid import UUID

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.merchant.product_variants import build_attributes_from_catalog, parse_variant_catalog
from app.application.merchant.schemas import MerchantProductUpdateRequest, ProductVariantCatalogInput
from app.application.visual_search.image_fetch import fetch_image_bytes
from app.application.visual_search.visual_search_engine import index_product_visual_embedding
from app.core.config import get_settings
from app.infrastructure.ai_clients.embedding import EmbeddingClient
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.infrastructure.storage.object_store import ObjectMediaStore
from app.interfaces.api.serializers import product_to_dict


class CatalogProductError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


class MerchantCatalogProductService:
    """Merchant CRM — live catalog CRUD."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = MarketplaceRepository(session)
        self._embed = EmbeddingClient()
        self._media = ObjectMediaStore()
        self._settings = get_settings()

    async def get_product(self, shop_id: UUID, product_id: UUID) -> dict:
        product = await self._repo.get_shop_product(shop_id, product_id)
        if not product:
            raise CatalogProductError("not_found", "Mahsulot topilmadi")
        payload = product_to_dict(product)
        payload["variant_catalog"] = parse_variant_catalog(product.attributes)
        return payload

    async def create_product(
        self,
        shop_id: UUID,
        *,
        name: str,
        price: int,
        description: str | None,
        stock_count: int,
        is_featured: bool,
        image_bytes: bytes,
        content_type: str,
        variant_catalog: ProductVariantCatalogInput | None = None,
        extra_image_bytes: list[tuple[bytes, str, str | None]] | None = None,
    ) -> dict:
        name = name.strip()
        if len(name) < 2:
            raise CatalogProductError("invalid_name", "Nom kamida 2 ta belgi")
        if not (0 < price < 100_000_000):
            raise CatalogProductError("invalid_price", "Narx 1 dan 99 999 999 gacha")
        if not image_bytes:
            raise CatalogProductError("image_required", "Rasm yuklang")

        ext = _extension_from_content_type(content_type)
        image_url = await self._media.save_product_image(
            shop_id=shop_id,
            image_bytes=image_bytes,
            extension=ext,
            content_type=content_type,
        )
        all_images = [image_url]
        if extra_image_bytes:
            for raw, ctype, _color in extra_image_bytes:
                ext = _extension_from_content_type(ctype)
                url = await self._media.save_product_image(
                    shop_id=shop_id,
                    image_bytes=raw,
                    extension=ext,
                    content_type=ctype,
                )
                all_images.append(url)

        vector, visual_vector, attrs = await self._build_embeddings(
            name=name,
            description=description,
            image_url=image_url,
            source="crm",
        )
        if variant_catalog:
            catalog_dict = variant_catalog.model_dump()
            attrs_patch, total_stock = build_attributes_from_catalog(
                catalog_dict,
                existing=attrs,
            )
            attrs = attrs_patch
            stock_count = total_stock if total_stock > 0 else stock_count
            if extra_image_bytes:
                self._merge_uploaded_color_images(attrs, extra_image_bytes, all_images[1:])
            gallery: list[str] = []
            for v in attrs.get("variants") or []:
                if isinstance(v, dict):
                    gallery.extend([str(u) for u in v.get("images") or [] if str(u).strip()])
            if gallery:
                all_images = list(dict.fromkeys([*gallery, *all_images]))

        product = await self._repo.create_product(
            shop_id=shop_id,
            category_id=None,
            name=name,
            description=description,
            price=price,
            images=all_images,
            attributes=attrs,
            embedding=vector,
            visual_embedding=visual_vector,
        )
        product.stock_count = max(0, stock_count)
        await self._session.commit()
        await self._session.refresh(product)
        if is_featured:
            await self._repo.set_product_featured(shop_id=shop_id, product_id=product.id, featured=True)
            await self._session.refresh(product)
        result = product_to_dict(product)
        result["variant_catalog"] = parse_variant_catalog(product.attributes)
        return result

    async def update_product(
        self,
        shop_id: UUID,
        product_id: UUID,
        payload: MerchantProductUpdateRequest,
    ) -> dict:
        product = await self._repo.get_shop_product(shop_id, product_id)
        if not product:
            raise CatalogProductError("not_found", "Mahsulot topilmadi")

        patch = payload.model_dump(exclude_none=True)
        reembed = False
        if "name" in patch:
            name = str(patch.pop("name")).strip()
            if len(name) < 2:
                raise CatalogProductError("invalid_name", "Nom kamida 2 ta belgi")
            product.name = name
            reembed = True
        if "description" in patch:
            product.description = patch.pop("description")
            reembed = True
        if "price" in patch:
            price = int(patch.pop("price"))
            if not (0 < price < 100_000_000):
                raise CatalogProductError("invalid_price", "Narx noto'g'ri")
            product.price = price
        if "stock_count" in patch:
            product.stock_count = max(0, int(patch.pop("stock_count")))
        if "is_available" in patch:
            product.is_available = bool(patch.pop("is_available"))
        if "is_featured" in patch:
            featured = bool(patch.pop("is_featured"))
            await self._repo.set_product_featured(shop_id=shop_id, product_id=product_id, featured=featured)

        variant_catalog = patch.pop("variant_catalog", None)
        if variant_catalog is not None:
            catalog_dict = variant_catalog if isinstance(variant_catalog, dict) else variant_catalog
            if hasattr(variant_catalog, "model_dump"):
                catalog_dict = variant_catalog.model_dump()
            attrs_patch, total_stock = build_attributes_from_catalog(
                catalog_dict,
                existing=dict(product.attributes or {}),
            )
            product.attributes = attrs_patch
            if total_stock > 0:
                product.stock_count = total_stock
            # Merge gallery from color images
            gallery: list[str] = []
            for v in attrs_patch.get("variants") or []:
                if isinstance(v, dict):
                    gallery.extend([str(u) for u in v.get("images") or [] if str(u).strip()])
            if gallery:
                product.images = list(dict.fromkeys([*gallery, *(product.images or [])]))

        if reembed:
            vector, visual_vector, attrs = await self._build_embeddings(
                name=product.name,
                description=product.description,
                image_url=(product.images or [None])[0],
                source="crm",
                existing_attrs=dict(product.attributes or {}),
            )
            product.embedding = vector
            if visual_vector is not None:
                product.visual_embedding = visual_vector
            merged = dict(product.attributes or {})
            merged.update(attrs)
            product.attributes = merged

        await self._session.commit()
        await self._session.refresh(product)
        result = product_to_dict(product)
        result["variant_catalog"] = parse_variant_catalog(product.attributes)
        return result

    async def upload_images(
        self,
        shop_id: UUID,
        product_id: UUID,
        *,
        items: list[tuple[bytes, str, str | None]],
    ) -> dict:
        product = await self._repo.get_shop_product(shop_id, product_id)
        if not product:
            raise CatalogProductError("not_found", "Mahsulot topilmadi")
        if not items:
            raise CatalogProductError("image_required", "Rasm tanlang")

        urls: list[str] = []
        for raw, ctype, _color in items:
            ext = _extension_from_content_type(ctype)
            url = await self._media.save_product_image(
                shop_id=shop_id,
                image_bytes=raw,
                extension=ext,
                content_type=ctype,
            )
            urls.append(url)

        attrs = dict(product.attributes or {})
        self._merge_uploaded_color_images(attrs, items, urls)
        product.attributes = attrs

        gallery: list[str] = []
        for v in attrs.get("variants") or []:
            if isinstance(v, dict):
                gallery.extend([str(u) for u in v.get("images") or [] if str(u).strip()])
        if gallery:
            product.images = list(dict.fromkeys([*gallery, *(product.images or [])]))
        elif urls:
            product.images = list(dict.fromkeys([*urls, *(product.images or [])]))

        await self._session.commit()
        await self._session.refresh(product)
        result = product_to_dict(product)
        result["variant_catalog"] = parse_variant_catalog(product.attributes)
        return result

    async def replace_image(
        self,
        shop_id: UUID,
        product_id: UUID,
        *,
        image_bytes: bytes,
        content_type: str,
    ) -> dict:
        product = await self._repo.get_shop_product(shop_id, product_id)
        if not product:
            raise CatalogProductError("not_found", "Mahsulot topilmadi")
        if not image_bytes:
            raise CatalogProductError("image_required", "Rasm yuklang")

        ext = _extension_from_content_type(content_type)
        image_url = await self._media.save_product_image(
            shop_id=shop_id,
            image_bytes=image_bytes,
            extension=ext,
            content_type=content_type,
        )
        product.images = [image_url]
        vector, visual_vector, attrs = await self._build_embeddings(
            name=product.name,
            description=product.description,
            image_url=image_url,
            source="crm",
            existing_attrs=dict(product.attributes or {}),
        )
        product.embedding = vector
        if visual_vector is not None:
            product.visual_embedding = visual_vector
        merged = dict(product.attributes or {})
        merged.update(attrs)
        product.attributes = merged
        await self._session.commit()
        await self._session.refresh(product)
        result = product_to_dict(product)
        result["variant_catalog"] = parse_variant_catalog(product.attributes)
        return result

    async def delete_product(self, shop_id: UUID, product_id: UUID) -> dict:
        product = await self._repo.get_shop_product(shop_id, product_id)
        if not product:
            raise CatalogProductError("not_found", "Mahsulot topilmadi")
        product.is_available = False
        product.is_featured = False
        await self._session.commit()
        return {"product_id": str(product.id), "deleted": True}

    @staticmethod
    def _merge_uploaded_color_images(
        attrs: dict,
        uploads: list[tuple[bytes, str, str | None]],
        urls: list[str],
    ) -> None:
        variants = list(attrs.get("variants") or [])
        color_images = dict(attrs.get("color_images") or {})
        url_iter = iter(urls)
        for _raw, _ctype, color in uploads:
            c = (color or "").strip()
            if not c:
                continue
            try:
                url = next(url_iter)
            except StopIteration:
                break
            found = False
            for v in variants:
                if isinstance(v, dict) and str(v.get("color") or "").strip() == c:
                    imgs = list(v.get("images") or [])
                    imgs.append(url)
                    v["images"] = imgs
                    found = True
                    break
            if not found:
                variants.append({"color": c, "images": [url], "sizes": []})
            color_images[c] = [*color_images.get(c, []), url]
        attrs["variants"] = variants
        attrs["color_images"] = color_images

    async def _build_embeddings(
        self,
        *,
        name: str,
        description: str | None,
        image_url: str | None,
        source: str,
        existing_attrs: dict | None = None,
    ) -> tuple[list[float], list[float] | None, dict]:
        embed_text = " ".join(filter(None, [name, description or ""]))
        try:
            vector = await self._embed.embed(embed_text)
        except Exception as exc:
            logger.exception("catalog_embedding_failed")
            raise CatalogProductError("embedding_failed", "Qidiruv indeksi yaratilmadi") from exc
        if len(vector) != 1536:
            raise CatalogProductError("embedding_failed", "Embedding o'lchami noto'g'ri")

        attrs = {**(existing_attrs or {}), "source": source}
        visual_vector: list[float] | None = None
        placeholder = f"{self._settings.site_url.rstrip('/')}/placeholder.svg"
        url = image_url or placeholder
        img_bytes = await fetch_image_bytes(url)
        if img_bytes:
            try:
                visual_vector, vsrc, phash = await index_product_visual_embedding(
                    image_bytes=img_bytes,
                    text_hint=embed_text,
                )
                attrs["visual_embed_source"] = vsrc
                if phash:
                    attrs["phash"] = phash
            except Exception:
                visual_vector = None
        return vector, visual_vector, attrs


def _extension_from_content_type(content_type: str) -> str:
    lowered = (content_type or "").lower()
    if "png" in lowered:
        return "png"
    if "webp" in lowered:
        return "webp"
    return "jpg"
