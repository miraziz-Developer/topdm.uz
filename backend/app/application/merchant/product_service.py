from __future__ import annotations

from uuid import UUID

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.merchant.schemas import (
    PendingProductItem,
    PublishPendingProductRequest,
    PublishPendingProductResult,
    RejectPendingProductRequest,
)
from app.core.config import get_settings
from app.domain.interfaces.notifier_gateway import NotifierGateway
from app.application.visual_search.image_fetch import fetch_image_bytes
from app.application.visual_search.visual_search_engine import index_product_visual_embedding
from app.infrastructure.ai_clients.embedding import EmbeddingClient
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.infrastructure.storage.telegram_media import TelegramMediaStore


class PublishPendingProductError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


class MerchantProductService:
    """Pending product moderation → live catalog (`products` + pgvector embedding)."""

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
        row = await self._repo.get_pending_product(pending_id, shop_id=shop_id)
        if not row:
            raise PublishPendingProductError("not_found", "Pending product not found")
        if row.status not in {"pending", "approved"}:
            raise PublishPendingProductError("invalid_status", f"Cannot publish status={row.status}")

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

        placeholder = f"{self._settings.site_url.rstrip('/')}/placeholder.svg"
        try:
            image_url = await self._media.resolve_permanent_url(
                shop_id=shop_id,
                telegram_file_id=row.telegram_file_id,
                fallback_placeholder=placeholder,
            )
        except ValueError as exc:
            raise PublishPendingProductError("image_failed", str(exc)) from exc

        embed_text = " ".join(
            filter(
                None,
                [
                    name,
                    str(attrs.get("category") or ""),
                    str(attrs.get("color") or ""),
                    str(attrs.get("material") or ""),
                    " ".join(attrs.get("style_tags") or []),
                ],
            )
        )
        try:
            vector = await self._embed.embed(embed_text)
        except Exception as exc:
            logger.exception("embedding_failed", pending_id=str(pending_id))
            raise PublishPendingProductError("embedding_failed", "Could not generate search embedding") from exc

        if len(vector) != 1536:
            raise PublishPendingProductError("embedding_failed", "Embedding dimension must be 1536")

        visual_vector: list[float] | None = None
        img_bytes = await fetch_image_bytes(image_url)
        product_attrs = {
            **{k: v for k, v in attrs.items() if k not in {"transcription"}},
            "pending_id": str(row.id),
            "source": attrs.get("source") or "telegram",
        }
        if img_bytes:
            try:
                visual_vector, vsrc, phash = await index_product_visual_embedding(
                    image_bytes=img_bytes,
                    text_hint=embed_text,
                )
                product_attrs["visual_embed_source"] = vsrc
                if phash:
                    product_attrs["phash"] = phash
            except Exception:
                visual_vector = None

        try:
            product = await self._repo.create_product(
                shop_id=shop_id,
                category_id=payload.category_id,
                name=name,
                description=payload.description,
                price=price,
                images=[image_url],
                attributes=product_attrs,
                embedding=vector,
                visual_embedding=visual_vector,
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
