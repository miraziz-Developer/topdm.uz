from __future__ import annotations

import uuid
from pathlib import Path

import httpx
from loguru import logger

from app.core.config import Settings, get_settings


class ObjectMediaStore:
    """Persist product images to local disk, Supabase Storage, or S3-compatible object storage."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        uploads = Path(__file__).resolve().parents[3] / "uploads"
        self._local_root = uploads / "products"
        self._local_stories_root = uploads / "stories"
        self._local_reels_root = uploads / "reels"
        self._local_banners_root = uploads / "banners"
        self._local_shops_root = uploads / "shops"
        self._local_root.mkdir(parents=True, exist_ok=True)
        self._local_stories_root.mkdir(parents=True, exist_ok=True)
        self._local_reels_root.mkdir(parents=True, exist_ok=True)
        self._local_banners_root.mkdir(parents=True, exist_ok=True)
        self._local_shops_root.mkdir(parents=True, exist_ok=True)
        self._local_reviews_root = uploads / "reviews"
        self._local_reviews_root.mkdir(parents=True, exist_ok=True)

    @property
    def backend(self) -> str:
        raw = (self._settings.media_storage_backend or "local").strip().lower()
        if raw in {"supabase", "s3"} and not self._backend_configured(raw):
            logger.warning("media_storage_misconfigured", backend=raw, fallback="local")
            return "local"
        return raw

    def _backend_configured(self, backend: str) -> bool:
        if backend == "supabase":
            return bool(self._settings.supabase_url and self._settings.supabase_service_role_key)
        if backend == "s3":
            return bool(
                self._settings.s3_bucket
                and self._settings.s3_access_key_id
                and self._settings.s3_secret_access_key
            )
        return True

    async def save_product_image(
        self,
        *,
        shop_id: uuid.UUID,
        image_bytes: bytes,
        extension: str = "jpg",
        content_type: str = "image/jpeg",
    ) -> str:
        backend = self.backend
        if backend == "supabase":
            return await self._upload_supabase(
                shop_id=shop_id,
                image_bytes=image_bytes,
                extension=extension,
                content_type=content_type,
                folder="products",
                media_segment="products",
            )
        if backend == "s3":
            return await self._upload_s3_async(
                shop_id=shop_id,
                image_bytes=image_bytes,
                extension=extension,
                content_type=content_type,
                folder="products",
            )
        return self._save_local(
            shop_id=shop_id,
            image_bytes=image_bytes,
            extension=extension,
            root=self._local_root,
            media_segment="products",
        )

    async def save_story_image(
        self,
        *,
        shop_id: uuid.UUID,
        image_bytes: bytes,
        extension: str = "jpg",
        content_type: str = "image/jpeg",
    ) -> str:
        backend = self.backend
        if backend == "supabase":
            return await self._upload_supabase(
                shop_id=shop_id,
                image_bytes=image_bytes,
                extension=extension,
                content_type=content_type,
                folder="stories",
                media_segment="stories",
            )
        if backend == "s3":
            return await self._upload_s3_async(
                shop_id=shop_id,
                image_bytes=image_bytes,
                extension=extension,
                content_type=content_type,
                folder="stories",
            )
        return self._save_local(
            shop_id=shop_id,
            image_bytes=image_bytes,
            extension=extension,
            root=self._local_stories_root,
            media_segment="stories",
        )

    async def save_reel_video(
        self,
        *,
        shop_id: uuid.UUID,
        video_bytes: bytes,
        extension: str = "mp4",
        content_type: str = "video/mp4",
    ) -> str:
        backend = self.backend
        if backend == "supabase":
            return await self._upload_supabase(
                shop_id=shop_id,
                image_bytes=video_bytes,
                extension=extension,
                content_type=content_type,
                folder="reels",
                media_segment="reels",
            )
        if backend == "s3":
            return await self._upload_s3_async(
                shop_id=shop_id,
                image_bytes=video_bytes,
                extension=extension,
                content_type=content_type,
                folder="reels",
            )
        return self._save_local(
            shop_id=shop_id,
            image_bytes=video_bytes,
            extension=extension,
            root=self._local_reels_root,
            media_segment="reels",
        )

    async def save_reel_thumbnail(
        self,
        *,
        shop_id: uuid.UUID,
        image_bytes: bytes,
        extension: str = "jpg",
        content_type: str = "image/jpeg",
    ) -> str:
        return await self.save_story_image(
            shop_id=shop_id,
            image_bytes=image_bytes,
            extension=extension,
            content_type=content_type,
        )

    async def save_review_image(
        self,
        *,
        shop_id: uuid.UUID,
        product_id: uuid.UUID,
        image_bytes: bytes,
        extension: str = "jpg",
        content_type: str = "image/jpeg",
    ) -> str:
        backend = self.backend
        folder = f"reviews/{product_id}"
        if backend == "supabase":
            return await self._upload_supabase(
                shop_id=shop_id,
                image_bytes=image_bytes,
                extension=extension,
                content_type=content_type,
                folder=folder,
                media_segment="reviews",
            )
        if backend == "s3":
            return await self._upload_s3_async(
                shop_id=shop_id,
                image_bytes=image_bytes,
                extension=extension,
                content_type=content_type,
                folder=folder,
            )
        shop_dir = self._local_reviews_root / str(product_id)
        shop_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid.uuid4()}.{extension}"
        path = shop_dir / filename
        path.write_bytes(image_bytes)
        prefix = self._settings.api_prefix.rstrip("/")
        return f"{prefix}/media/reviews/{product_id}/{filename}"

    async def save_shop_image(
        self,
        *,
        shop_id: uuid.UUID,
        image_bytes: bytes,
        extension: str = "jpg",
        content_type: str = "image/jpeg",
        kind: str = "logo",
    ) -> str:
        """Do'kon logosi yoki muqova (storefront)."""
        folder = f"shops/{kind}"
        backend = self.backend
        if backend == "supabase":
            return await self._upload_supabase(
                shop_id=shop_id,
                image_bytes=image_bytes,
                extension=extension,
                content_type=content_type,
                folder=folder,
                media_segment="shops",
            )
        if backend == "s3":
            return await self._upload_s3_async(
                shop_id=shop_id,
                image_bytes=image_bytes,
                extension=extension,
                content_type=content_type,
                folder=folder,
            )
        shop_dir = self._local_shops_root / str(shop_id) / kind
        shop_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid.uuid4()}.{extension}"
        path = shop_dir / filename
        path.write_bytes(image_bytes)
        prefix = self._settings.api_prefix.rstrip("/")
        return f"{prefix}/media/shops/{shop_id}/{kind}/{filename}"

    async def save_banner_image(
        self,
        *,
        shop_id: uuid.UUID,
        image_bytes: bytes,
        extension: str = "jpg",
        content_type: str = "image/jpeg",
    ) -> str:
        backend = self.backend
        if backend == "supabase":
            return await self._upload_supabase(
                shop_id=shop_id,
                image_bytes=image_bytes,
                extension=extension,
                content_type=content_type,
                folder="banners",
                media_segment="banners",
            )
        if backend == "s3":
            return await self._upload_s3_async(
                shop_id=shop_id,
                image_bytes=image_bytes,
                extension=extension,
                content_type=content_type,
                folder="banners",
            )
        return self._save_local(
            shop_id=shop_id,
            image_bytes=image_bytes,
            extension=extension,
            root=self._local_banners_root,
            media_segment="banners",
        )

    def _save_local(
        self,
        *,
        shop_id: uuid.UUID,
        image_bytes: bytes,
        extension: str,
        root: Path,
        media_segment: str,
    ) -> str:
        shop_dir = root / str(shop_id)
        shop_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid.uuid4()}.{extension}"
        path = shop_dir / filename
        path.write_bytes(image_bytes)
        prefix = self._settings.api_prefix.rstrip("/")
        # Relative URL — works via same-origin /api proxy (dev) and nginx /api/v1 (prod).
        return f"{prefix}/media/{media_segment}/{shop_id}/{filename}"

    async def _upload_supabase(
        self,
        *,
        shop_id: uuid.UUID,
        image_bytes: bytes,
        extension: str,
        content_type: str,
        folder: str = "products",
        media_segment: str = "products",
    ) -> str:
        bucket = self._settings.supabase_storage_bucket or "products"
        object_path = f"{folder}/{shop_id}/{uuid.uuid4()}.{extension}"
        base = self._settings.supabase_url.rstrip("/")
        url = f"{base}/storage/v1/object/{bucket}/{object_path}"
        headers = {
            "Authorization": f"Bearer {self._settings.supabase_service_role_key}",
            "Content-Type": content_type,
            "x-upsert": "true",
        }
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, content=image_bytes, headers=headers)
            resp.raise_for_status()
        return f"{base}/storage/v1/object/public/{bucket}/{object_path}"

    async def _upload_s3_async(
        self,
        *,
        shop_id: uuid.UUID,
        image_bytes: bytes,
        extension: str,
        content_type: str,
        folder: str = "products",
    ) -> str:
        from app.infrastructure.storage.s3_async import upload_bytes

        key = f"{folder}/{shop_id}/{uuid.uuid4()}.{extension}"
        return await upload_bytes(
            settings=self._settings,
            key=key,
            body=image_bytes,
            content_type=content_type,
        )
