"""Reels service — upload, merchant management, shop gallery."""
from __future__ import annotations

import uuid
from typing import Any
from uuid import UUID

from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.reels.feed_algorithm import compute_video_score, _video_to_dict
from app.application.reels.feed_enrichment import enrich_reel_dict
from app.core.config import get_settings
from app.models.reels import ReelsVideoModel


class ReelsService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._settings = get_settings()

    # ── Upload ──────────────────────────────────────────────────
    async def upload_video(
        self,
        *,
        shop_id: UUID,
        video_bytes: bytes,
        caption: str | None,
        hashtags: list[str],
        tagged_product_ids: list[str],
        content_type: str = "video/mp4",
        thumbnail_bytes: bytes | None = None,
        duration_seconds: float | None = None,
    ) -> dict[str, Any]:
        """Video S3 / lokal diskga saqlash va DB ga yozish."""
        video_url = await self._save_video(shop_id, video_bytes, content_type)
        thumbnail_url = None
        if thumbnail_bytes:
            thumbnail_url = await self._save_thumbnail(shop_id, thumbnail_bytes)
        elif thumbnail_url is None:
            from app.infrastructure.db.models import ShopModel

            shop = await self._db.get(ShopModel, shop_id)
            logo = (shop.logo_url or "").strip() if shop else ""
            if logo:
                thumbnail_url = logo

        # Hashtag tozalash
        clean_tags = [t.lstrip("#").lower().strip() for t in hashtags if t.strip()]
        clean_product_ids = [str(pid) for pid in tagged_product_ids if pid]

        # Kategoriya avtomatik tanlash (hashtaglardan)
        category_tags = _infer_categories(caption or "", clean_tags)

        video = ReelsVideoModel(
            id=uuid.uuid4(),
            shop_id=shop_id,
            video_url=video_url,
            thumbnail_url=thumbnail_url,
            duration_seconds=duration_seconds,
            caption=caption,
            hashtags=clean_tags,
            tagged_product_ids=clean_product_ids,
            category_tags=category_tags,
            status="active",
            is_active=True,
            algorithm_score=0.5,  # yangi video boshlang'ich score
        )
        self._db.add(video)
        await self._db.commit()
        await self._db.refresh(video)
        return _video_to_dict(video)

    async def delete_video(self, shop_id: UUID, video_id: UUID) -> bool:
        video = await self._db.get(ReelsVideoModel, video_id)
        if not video or video.shop_id != shop_id:
            return False
        video.is_active = False
        video.status = "deleted"
        await self._db.commit()
        return True

    async def update_video(
        self,
        shop_id: UUID,
        video_id: UUID,
        *,
        caption: str | None = None,
        tagged_product_ids: list[str] | None = None,
        hashtags: list[str] | None = None,
    ) -> dict[str, Any] | None:
        video = await self._db.get(ReelsVideoModel, video_id)
        if not video or video.shop_id != shop_id:
            return None
        if caption is not None:
            video.caption = caption
        if tagged_product_ids is not None:
            video.tagged_product_ids = [str(p) for p in tagged_product_ids]
        if hashtags is not None:
            video.hashtags = [t.lstrip("#").lower().strip() for t in hashtags]
        await self._db.commit()
        await self._db.refresh(video)
        return _video_to_dict(video)

    # ── Shop gallery ─────────────────────────────────────────────
    async def get_shop_reels(
        self,
        shop_id: UUID,
        *,
        page: int = 0,
        limit: int = 24,
    ) -> dict[str, Any]:
        stmt = (
            select(ReelsVideoModel)
            .where(
                and_(
                    ReelsVideoModel.shop_id == shop_id,
                    ReelsVideoModel.status != "deleted",
                )
            )
            .order_by(desc(ReelsVideoModel.created_at))
            .offset(page * limit)
            .limit(limit)
        )
        count_stmt = select(ReelsVideoModel).where(
            and_(ReelsVideoModel.shop_id == shop_id, ReelsVideoModel.status != "deleted")
        )
        result = await self._db.execute(stmt)
        videos = result.scalars().all()
        cnt = await self._db.execute(count_stmt)
        total = len(cnt.scalars().all())

        return {
            "items": [enrich_reel_dict(v, _video_to_dict(v)) for v in videos],
            "total": total,
            "page": page,
            "has_more": (page + 1) * limit < total,
        }

    # ── Internal storage ─────────────────────────────────────────
    async def _save_video(self, shop_id: UUID, data: bytes, content_type: str) -> str:
        ct = (content_type or "").lower()
        if "webm" in ct:
            ext = "webm"
        elif "quicktime" in ct or "mov" in ct:
            ext = "mov"
        else:
            ext = "mp4"
        from app.infrastructure.storage.object_store import ObjectMediaStore

        store = ObjectMediaStore(self._settings)
        return await store.save_reel_video(
            shop_id=shop_id,
            video_bytes=data,
            extension=ext,
            content_type=content_type or "video/mp4",
        )

    async def _save_thumbnail(self, shop_id: UUID, data: bytes) -> str:
        from app.infrastructure.storage.object_store import ObjectMediaStore

        store = ObjectMediaStore(self._settings)
        return await store.save_reel_thumbnail(
            shop_id=shop_id,
            image_bytes=data,
            extension="jpg",
            content_type="image/jpeg",
        )


def _infer_categories(caption: str, tags: list[str]) -> list[str]:
    """Caption va hashtag'lardan kategoriya tanlash."""
    text = (caption + " " + " ".join(tags)).lower()
    cats: list[str] = []
    mapping = {
        "fashion": ["kiyim", "moda", "fashion", "style", "look", "outfit"],
        "shoes": ["poyabzal", "krossovka", "tufli", "shoes"],
        "sport": ["sport", "fitnes", "gym"],
        "beauty": ["go'zallik", "parfyum", "atir", "beauty"],
        "kids": ["bolalar", "maktab", "kids"],
        "textile": ["mato", "tekstil", "gazmol"],
        "accessories": ["aksessuar", "sumka", "kamar"],
        "prikol": ["prikol", "funny", "ko'ng'il", "kulgili"],
        "wholesale": ["optom", "wholesale", "ulgurji"],
    }
    for cat, keywords in mapping.items():
        if any(kw in text for kw in keywords):
            cats.append(cat)
    return cats or ["fashion"]
