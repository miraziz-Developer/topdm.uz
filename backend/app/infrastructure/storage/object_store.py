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
        self._local_banners_root = uploads / "banners"
        self._local_root.mkdir(parents=True, exist_ok=True)
        self._local_stories_root.mkdir(parents=True, exist_ok=True)
        self._local_banners_root.mkdir(parents=True, exist_ok=True)

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
            return await self._upload_s3(
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
            return await self._upload_s3(
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
            return await self._upload_s3(
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

    async def _upload_s3(
        self,
        *,
        shop_id: uuid.UUID,
        image_bytes: bytes,
        extension: str,
        content_type: str,
        folder: str = "products",
    ) -> str:
        try:
            import boto3
            from botocore.config import Config
        except ImportError as exc:
            raise RuntimeError("Install boto3 for S3 media storage (pip install boto3)") from exc

        key = f"{folder}/{shop_id}/{uuid.uuid4()}.{extension}"
        client = boto3.client(
            "s3",
            endpoint_url=self._settings.s3_endpoint_url or None,
            aws_access_key_id=self._settings.s3_access_key_id,
            aws_secret_access_key=self._settings.s3_secret_access_key,
            region_name=self._settings.s3_region or "auto",
            config=Config(signature_version="s3v4"),
        )
        client.put_object(
            Bucket=self._settings.s3_bucket,
            Key=key,
            Body=image_bytes,
            ContentType=content_type,
            CacheControl="public, max-age=31536000, immutable",
        )
        public_base = (self._settings.s3_public_base_url or "").rstrip("/")
        if public_base:
            return f"{public_base}/{key}"
        if self._settings.s3_endpoint_url:
            return f"{self._settings.s3_endpoint_url.rstrip('/')}/{self._settings.s3_bucket}/{key}"
        return f"https://{self._settings.s3_bucket}.s3.amazonaws.com/{key}"
