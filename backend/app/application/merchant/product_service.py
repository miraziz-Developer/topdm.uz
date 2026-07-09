from __future__ import annotations

from uuid import UUID

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.merchant.product_hashtags import hashtags_for_publish
from app.application.merchant.product_variants import apply_warehouse_stock, build_attributes_from_catalog
from app.application.merchant.schemas import (
    PendingProductItem,
    PublishPendingProductRequest,
    PublishPendingProductResult,
    RejectPendingProductRequest,
)
from app.application.merchant.telegram_variant_draft import draft_to_catalog_payload, get_variant_draft
from app.core.config import get_settings
from app.domain.interfaces.notifier_gateway import NotifierGateway
from app.application.visual_search.image_fetch import fetch_image_bytes
from app.infrastructure.ai_clients.embedding import EmbeddingClient, _deterministic_embed
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.infrastructure.storage.telegram_media import TelegramMediaStore


class PublishPendingProductError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


AWAITING_REVIEW = "awaiting_review"


def _stored_image_urls(attrs: dict) -> list[str]:
    urls: list[str] = []
    for raw in attrs.get("images") or []:
        text = str(raw).strip()
        if text:
            urls.append(text)
    for key in ("image_url", "preview_url", "thumbnail_url"):
        text = str(attrs.get(key) or "").strip()
        if text:
            urls.append(text)
    variants = attrs.get("variants")
    if isinstance(variants, list):
        for variant in variants:
            if not isinstance(variant, dict):
                continue
            for raw in variant.get("images") or []:
                text = str(raw).strip()
                if text:
                    urls.append(text)
    return list(dict.fromkeys(urls))


class MerchantProductService:
    """Telegram/CRM draft → live catalog (`products` + pgvector embedding)."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        notifier: NotifierGateway | None = None,
    ) -> None:
        self._session = session
        self._repo = MarketplaceRepository(session)
        self._embed = EmbeddingClient()
        self._media = TelegramMediaStore()
        self._notifier = notifier
        self._settings = get_settings()

    async def list_pending(self, shop_id: UUID, *, status: str = "pending") -> list[PendingProductItem]:
        rows = await self._repo.list_pending_products(shop_id, status=status)
        return [self._to_pending_item(r) for r in rows]

    async def publish_pending_product(
        self,
        pending_id: UUID,
        *,
        shop_id: UUID,
        payload: PublishPendingProductRequest | None = None,
    ) -> PublishPendingProductResult:
        payload = payload or PublishPendingProductRequest()
        # Row-level lock — ikki marta «Yuklash» bosilsa dublikat mahsulot yaralmasin.
        row = await self._repo.get_pending_product(pending_id, shop_id=shop_id, for_update=True)
        if not row:
            raise PublishPendingProductError("not_found", "Pending product not found")
        if row.status == "published" and row.published_product_id:
            product = await self._repo.get_product_by_id(row.published_product_id)
            if product:
                images = list(product.images or [])
                await self._session.commit()
                return PublishPendingProductResult(
                    pending_id=row.id,
                    product_id=product.id,
                    product_name=product.name,
                    image_url=images[0] if images else None,
                    status="published",
                )
        if row.status == "publishing":
            raise PublishPendingProductError(
                "invalid_status", "Mahsulot hozir yuklanmoqda — biroz kuting."
            )
        if row.status not in {"pending", "rejected", "approved", AWAITING_REVIEW}:
            raise PublishPendingProductError("invalid_status", f"Cannot publish status={row.status}")

        # Qatorni «publishing» deb band qilamiz va lockni bo'shatamiz — raqib so'rov bloklanadi.
        prior_status = row.status
        await self._repo.update_pending_product(row, status="publishing")
        await self._session.commit()

        try:
            return await self._do_publish_pending(row, pending_id, shop_id=shop_id, payload=payload)
        except Exception:
            # Xato bo'lsa merchant qayta urinishi uchun holatni tiklaymiz.
            try:
                fresh = await self._repo.get_pending_product(pending_id, shop_id=shop_id)
                if fresh and fresh.status == "publishing":
                    await self._repo.update_pending_product(fresh, status=prior_status)
                    await self._session.commit()
            except Exception:
                logger.warning("publish_status_reset_failed", pending_id=str(pending_id))
            raise

    async def _do_publish_pending(
        self,
        row,
        pending_id: UUID,
        *,
        shop_id: UUID,
        payload: PublishPendingProductRequest,
    ) -> PublishPendingProductResult:
        attrs = dict(row.vision_attributes or {})
        name = (payload.name or attrs.get("product_name") or attrs.get("category") or "Yangi tovar").strip()
        if len(name) < 2:
            raise PublishPendingProductError("invalid_name", "Product name is required")

        price_raw = payload.price_uzs if payload.price_uzs is not None else attrs.get("price_uzs")
        try:
            price = int(price_raw)
        except (TypeError, ValueError):
            raise PublishPendingProductError("invalid_price", "Valid price in UZS is required")
        if not (0 < price < 100_000_000):
            raise PublishPendingProductError("invalid_price", "Price must be between 1 and 100,000,000 UZS")

        draft = get_variant_draft(attrs)
        warehouse_stock = max(0, int(draft.get("fallback_stock") or 0))
        if warehouse_stock < 1:
            raise PublishPendingProductError(
                "stock_required",
                "Omborda nechta borligini kiriting (kamida 1 dona)",
            )

        placeholder = f"{self._settings.site_url.rstrip('/')}/placeholder.svg"
        catalog_payload = draft_to_catalog_payload(draft)
        image_urls: list[str] = []

        async def _resolve_file_id(file_id: str | None) -> str | None:
            if not file_id:
                return None
            try:
                return await self._media.resolve_permanent_url(
                    shop_id=shop_id,
                    telegram_file_id=file_id,
                    fallback_placeholder=placeholder,
                )
            except ValueError:
                return None

        if catalog_payload["colors"]:
            for color_row in catalog_payload["colors"]:
                resolved: list[str] = []
                for file_id in color_row.pop("telegram_file_ids", []) or []:
                    url = await _resolve_file_id(str(file_id))
                    if url:
                        resolved.append(url)
                if not resolved:
                    resolved = [
                        str(u).strip()
                        for u in (color_row.get("image_urls") or [])
                        if str(u).strip()
                    ]
                color_row["image_urls"] = resolved
                image_urls.extend(resolved)
        else:
            primary_url = await _resolve_file_id(row.telegram_file_id)
            if not primary_url:
                for candidate in _stored_image_urls(attrs):
                    primary_url = candidate
                    break
            if not primary_url:
                raise PublishPendingProductError("image_failed", "Rasmni saqlab bo'lmadi")
            image_urls = [primary_url]
            color_name = str(attrs.get("color") or "Asosiy").strip() or "Asosiy"
            catalog_payload = {
                "all_sizes": draft.get("all_sizes") or [],
                "colors": [{"name": color_name, "sizes": draft.get("all_sizes") or [], "image_urls": [primary_url]}],
                "sku_stock": {},
                "fallback_stock": warehouse_stock,
            }

        if not image_urls:
            raise PublishPendingProductError("image_failed", "Kamida bitta rasm kerak")

        image_url = image_urls[0]

        shop = await self._repo.get_shop(shop_id)
        if not shop:
            raise PublishPendingProductError("not_found", "Do'kon topilmadi")
        if not shop.is_verified:
            raise PublishPendingProductError(
                "shop_not_verified",
                "Do'kon hali tasdiqlanmagan. Moderator arizangizni ko'rib chiqmoqda (24 soat ichida).",
            )

        from app.application.merchant.category_resolver import enrich_attrs_with_category

        attrs["product_name"] = name
        attrs = await enrich_attrs_with_category(self._session, attrs)

        tags = hashtags_for_publish(attrs)
        embed_text = " ".join(
            filter(
                None,
                [
                    name,
                    str(attrs.get("category") or ""),
                    str(attrs.get("category_label") or ""),
                    str(attrs.get("color") or ""),
                    str(attrs.get("material") or ""),
                    " ".join(attrs.get("style_tags") or []),
                    " ".join(f"#{t}" for t in tags),
                ],
            )
        )
        try:
            vector = await self._embed.embed(embed_text)
        except Exception as exc:
            logger.warning("embedding_failed_using_fallback", pending_id=str(pending_id), error=str(exc)[:180])
            vector = _deterministic_embed(embed_text)

        if len(vector) != 1536:
            raise PublishPendingProductError("embedding_failed", "Embedding dimension must be 1536")

        visual_vector: list[float] | None = None
        img_bytes = await fetch_image_bytes(image_url)
        if not img_bytes and row.telegram_file_id:
            try:
                data, _mime = await self._media.download_telegram_file(row.telegram_file_id)
                img_bytes = data
            except Exception:
                logger.warning("publish_image_telegram_fallback_failed", pending_id=str(pending_id))

        if not img_bytes:
            raise PublishPendingProductError(
                "image_failed",
                "Mahsulot rasmini yuklab bo'lmadi — qayta rasm yuboring.",
            )

        variant_attrs, _total_stock = build_attributes_from_catalog(
            catalog_payload,
            existing={k: v for k, v in attrs.items() if k not in {"transcription", "variant_draft"}},
        )
        variant_attrs, stock_count = apply_warehouse_stock(variant_attrs, warehouse_stock)
        product_attrs = {
            **variant_attrs,
            "pending_id": str(row.id),
            "source": attrs.get("source") or "telegram",
            "hashtags": tags,
        }
        if img_bytes:
            # CLIP/YOLOS 4GB CORE da OOM — faqat yengil signature (tez, xavfsiz).
            visual_vector, visual_meta = self._lightweight_visual_embed(img_bytes)
            product_attrs.update(visual_meta)

        resolved_category_id = payload.category_id
        if resolved_category_id is None and attrs.get("category_id"):
            try:
                from uuid import UUID

                resolved_category_id = UUID(str(attrs["category_id"]))
            except (TypeError, ValueError):
                resolved_category_id = None

        try:
            product = await self._repo.create_product(
                shop_id=shop_id,
                category_id=resolved_category_id,
                name=name,
                description=payload.description,
                price=price,
                images=image_urls,
                attributes=product_attrs,
                embedding=vector,
                visual_embedding=visual_vector,
                stock_count=stock_count,
            )
        except Exception as exc:
            logger.exception("product_create_failed", pending_id=str(pending_id))
            raise PublishPendingProductError("publish_failed", "Failed to create product") from exc

        await self._repo.update_pending_product(
            row,
            status="published",
            published_product_id=product.id,
        )

        await self._session.commit()
        await self._notify_published(shop_id=shop_id, product_name=name)

        return PublishPendingProductResult(
            pending_id=row.id,
            product_id=product.id,
            product_name=name,
            image_url=image_url,
            status="published",
        )

    async def update_warehouse_stock(
        self,
        product_id: UUID,
        *,
        shop_id: UUID,
        stock: int,
    ) -> tuple[str, int]:
        product = await self._repo.get_shop_product(shop_id, product_id)
        if not product:
            raise PublishPendingProductError("not_found", "Mahsulot topilmadi")
        stock = max(0, min(99_999, int(stock)))
        attrs, total = apply_warehouse_stock(dict(product.attributes or {}), stock)
        product.attributes = attrs
        product.stock_count = total
        product.is_available = total > 0
        await self._session.commit()
        return product.name, total

    async def reject_pending_product(
        self,
        pending_id: UUID,
        *,
        shop_id: UUID,
        payload: RejectPendingProductRequest | None = None,
    ) -> PendingProductItem:
        payload = payload or RejectPendingProductRequest()
        row = await self._repo.get_pending_product(pending_id, shop_id=shop_id)
        if not row:
            raise PublishPendingProductError("not_found", "Pending product not found")
        if row.status != "pending":
            raise PublishPendingProductError("invalid_status", f"Cannot reject status={row.status}")

        row = await self._repo.update_pending_product(
            row,
            status="rejected",
            moderation_reason=payload.reason,
        )
        await self._session.commit()
        shop = await self._repo.get_shop(shop_id)
        if shop and shop.telegram_chat_id and self._notifier:
            try:
                from app.application.merchant.telegram_crm_notify import notify_merchant_telegram

                await notify_merchant_telegram(
                    self._notifier,
                    chat_id=int(shop.telegram_chat_id),
                    text=f"Mahsulot rad etildi: {payload.reason}",
                    shop_id=shop_id,
                    crm_next="/dashboard/products",
                )
            except Exception:
                logger.warning("reject_notify_failed", shop_id=str(shop_id), pending_id=str(pending_id))
        return self._to_pending_item(row)

    async def update_pending_draft(
        self,
        pending_id: UUID,
        *,
        shop_id: UUID,
        vision_patch: dict,
    ) -> PendingProductItem:
        row = await self._repo.get_pending_product(pending_id, shop_id=shop_id)
        if not row:
            raise PublishPendingProductError("not_found", "Pending product not found")
        if row.status != "pending":
            raise PublishPendingProductError("invalid_status", "Only pending items can be edited")

        merged = {**(row.vision_attributes or {}), **vision_patch}
        row = await self._repo.update_pending_product(row, vision_attributes=merged)
        return self._to_pending_item(row)

    @staticmethod
    def _lightweight_visual_embed(image_bytes: bytes) -> tuple[list[float] | None, dict]:
        from app.application.visual_search.crop_preprocess import prepare_taobao_crop_bytes
        from app.application.visual_search.visual_signature import image_phash_hex, image_visual_signature

        try:
            prepared = prepare_taobao_crop_bytes(image_bytes)
            return image_visual_signature(prepared), {
                "visual_embed_source": "signature",
                "phash": image_phash_hex(prepared),
            }
        except Exception as exc:
            logger.warning("lightweight_visual_embed_failed", error=str(exc)[:180])
            return None, {}

    async def _notify_published(self, *, shop_id: UUID, product_name: str) -> None:
        if not self._notifier:
            return
        shop = await self._repo.get_shop(shop_id)
        if not shop or not shop.telegram_chat_id:
            return
        try:
            from app.application.merchant.telegram_crm_notify import notify_merchant_telegram

            await notify_merchant_telegram(
                self._notifier,
                chat_id=int(shop.telegram_chat_id),
                text=f"Sizning '{product_name}' mahsulotingiz endi Bozorliii.uz da LIVE!",
                shop_id=shop_id,
                crm_next="/dashboard/products",
            )
            logger.info("product_published_notify", shop_id=str(shop_id), product_name=product_name)
        except Exception:
            logger.warning("product_published_notify_failed", shop_id=str(shop_id))

    @staticmethod
    def _to_pending_item(row) -> PendingProductItem:
        return PendingProductItem(
            id=row.id,
            shop_id=row.shop_id,
            status=row.status,
            moderation_reason=row.moderation_reason,
            telegram_file_id=row.telegram_file_id,
            vision_attributes=dict(row.vision_attributes or {}),
            published_product_id=row.published_product_id,
            created_at=row.created_at,
            updated_at=getattr(row, "updated_at", None),
        )
