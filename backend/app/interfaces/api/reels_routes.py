"""Topdim.UZ Reels API — video feed, upload, interactions."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.reels.feed_algorithm import get_personalized_feed, record_interaction
from app.application.reels.reels_service import ReelsService
from app.infrastructure.auth.deps import require_merchant_shop, get_optional_user
from app.infrastructure.auth.types import AuthUser
from app.infrastructure.db.session import get_db_session

router = APIRouter(prefix="/reels", tags=["reels"])

MAX_VIDEO_MB = 50
MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024


# ════════════════════════════════════════════════════════════════
# 1. PUBLIC FEED
# ════════════════════════════════════════════════════════════════
@router.get("/feed")
async def reels_feed(
    page: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=20),
    category: str | None = Query(default=None),
    shop_slug: str | None = Query(default=None),
    session_id: str = Query(default="guest"),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """TikTok-style algorithmic feed."""
    shop_id: UUID | None = None
    if shop_slug:
        from sqlalchemy import select, text
        try:
            result = await db.execute(
                text("SELECT id FROM shops WHERE slug = :slug AND is_active = true LIMIT 1"),
                {"slug": shop_slug},
            )
            row = result.first()
            if row:
                shop_id = row[0]
        except Exception:
            pass

    videos = await get_personalized_feed(
        db,
        session_id=session_id,
        page=page,
        limit=limit,
        category_hint=category,
        shop_id=shop_id,
    )

    # Fetch tagged products
    all_product_ids = list({pid for v in videos for pid in v.get("tagged_product_ids", [])})
    products_by_id: dict[str, dict] = {}
    if all_product_ids:
        products_by_id = await _fetch_products_by_ids(db, all_product_ids)

    # Enrich videos with product data
    for v in videos:
        v["tagged_products"] = [
            products_by_id[pid] for pid in v.get("tagged_product_ids", []) if pid in products_by_id
        ]

    return {
        "items": videos,
        "page": page,
        "has_more": len(videos) == limit,
    }


# ════════════════════════════════════════════════════════════════
# 2. SHOP GALLERY (public)
# ════════════════════════════════════════════════════════════════
@router.get("/shop/{shop_slug}")
async def shop_reels_gallery(
    shop_slug: str,
    page: int = Query(default=0, ge=0),
    limit: int = Query(default=24, ge=1, le=48),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Do'kon profili — TikTok 3-ustunli gallery."""
    from sqlalchemy import text
    try:
        result = await db.execute(
            text("SELECT id FROM shops WHERE slug = :slug AND is_active = true LIMIT 1"),
            {"slug": shop_slug},
        )
        row = result.first()
        if not row:
            raise HTTPException(404, "Shop not found")
        shop_id = row[0]
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(500, "DB error")

    svc = ReelsService(db)
    return await svc.get_shop_reels(shop_id, page=page, limit=limit)


# ════════════════════════════════════════════════════════════════
# 3. INTERACTION (view, like, share)
# ════════════════════════════════════════════════════════════════
class InteractionBody(BaseModel):
    video_id: UUID
    session_id: str = Field(default="guest", max_length=128)
    watch_seconds: float = Field(default=0.0, ge=0)
    watch_pct: float = Field(default=0.0, ge=0, le=1)
    is_liked: bool | None = None
    is_shared: bool | None = None
    is_saved: bool | None = None
    tapped_product: bool | None = None


@router.post("/interaction")
async def record_reels_interaction(
    body: InteractionBody,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    await record_interaction(
        db,
        video_id=body.video_id,
        session_id=body.session_id,
        watch_pct=body.watch_pct,
        watch_seconds=body.watch_seconds,
        is_liked=body.is_liked,
        is_shared=body.is_shared,
        is_saved=body.is_saved,
        tapped_product=body.tapped_product,
    )
    return {"ok": True}


class ReelsCommentCreateBody(BaseModel):
    session_id: str = Field(default="guest", max_length=128)
    text: str = Field(min_length=1, max_length=500)


@router.get("/{video_id}/comments")
async def list_reels_comments(
    video_id: UUID,
    limit: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.models.reels import ReelsCommentModel

    stmt = (
        select(ReelsCommentModel)
        .where(
            and_(
                ReelsCommentModel.video_id == video_id,
                ReelsCommentModel.is_deleted.is_(False),
            )
        )
        .order_by(desc(ReelsCommentModel.created_at))
        .limit(limit)
    )
    result = await db.execute(stmt)
    items = result.scalars().all()
    return {
        "items": [
            {
                "id": str(i.id),
                "video_id": str(i.video_id),
                "session_id": i.user_session_id,
                "text": i.comment_text,
                "reported_count": i.reported_count,
                "created_at": i.created_at.isoformat() if i.created_at else None,
            }
            for i in items
        ]
    }


@router.post("/{video_id}/comments")
async def create_reels_comment(
    video_id: UUID,
    body: ReelsCommentCreateBody,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.models.reels import ReelsCommentModel, ReelsVideoModel

    text_clean = body.text.strip()
    if not text_clean:
        raise HTTPException(status_code=400, detail="Comment matni bo'sh bo'lmasligi kerak")

    video = await db.get(ReelsVideoModel, video_id)
    if not video or not video.is_active or video.status != "active":
        raise HTTPException(status_code=404, detail="Video topilmadi")

    comment = ReelsCommentModel(
        video_id=video_id,
        user_session_id=body.session_id,
        comment_text=text_clean,
    )
    db.add(comment)
    video.comments_count = (video.comments_count or 0) + 1
    await db.commit()
    await db.refresh(comment)

    return {
        "ok": True,
        "item": {
            "id": str(comment.id),
            "video_id": str(comment.video_id),
            "session_id": comment.user_session_id,
            "text": comment.comment_text,
            "reported_count": comment.reported_count,
            "created_at": comment.created_at.isoformat() if comment.created_at else None,
        },
        "comments_count": video.comments_count,
    }


class ReelsCommentDeleteBody(BaseModel):
    session_id: str = Field(default="guest", max_length=128)


@router.delete("/{video_id}/comments/{comment_id}")
async def delete_reels_comment(
    video_id: UUID,
    comment_id: UUID,
    body: ReelsCommentDeleteBody,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.models.reels import ReelsCommentModel, ReelsVideoModel

    comment = await db.get(ReelsCommentModel, comment_id)
    if not comment or comment.video_id != video_id:
        raise HTTPException(status_code=404, detail="Comment topilmadi")
    if comment.user_session_id != body.session_id:
        raise HTTPException(status_code=403, detail="Faqat o'z commentingizni o'chira olasiz")
    if comment.is_deleted:
        return {"ok": True}

    comment.is_deleted = True
    comment.deleted_reason = "author_deleted"
    comment.deleted_at = datetime.now(timezone.utc)

    video = await db.get(ReelsVideoModel, video_id)
    if video:
        video.comments_count = max(0, (video.comments_count or 0) - 1)

    await db.commit()
    return {"ok": True}


class ReelsCommentReportBody(BaseModel):
    session_id: str = Field(default="guest", max_length=128)
    reason: str | None = Field(default=None, max_length=200)


@router.post("/{video_id}/comments/{comment_id}/report")
async def report_reels_comment(
    video_id: UUID,
    comment_id: UUID,
    body: ReelsCommentReportBody,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.models.reels import ReelsCommentModel, ReelsCommentReportModel

    comment = await db.get(ReelsCommentModel, comment_id)
    if not comment or comment.video_id != video_id or comment.is_deleted:
        raise HTTPException(status_code=404, detail="Comment topilmadi")

    exists_stmt = select(ReelsCommentReportModel).where(
        and_(
            ReelsCommentReportModel.comment_id == comment_id,
            ReelsCommentReportModel.user_session_id == body.session_id,
        )
    ).limit(1)
    exists_result = await db.execute(exists_stmt)
    exists = exists_result.scalar_one_or_none()
    if exists:
        return {"ok": True, "already_reported": True, "reported_count": comment.reported_count}

    report = ReelsCommentReportModel(
        comment_id=comment_id,
        video_id=video_id,
        user_session_id=body.session_id,
        reason=(body.reason or "").strip()[:200] or None,
    )
    db.add(report)
    comment.reported_count = (comment.reported_count or 0) + 1
    await db.commit()
    return {"ok": True, "reported_count": comment.reported_count}


@router.get("/merchant/comments/reported")
async def merchant_reported_comments(
    limit: int = Query(default=50, ge=1, le=200),
    shop_id: UUID = Depends(require_merchant_shop),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.models.reels import ReelsCommentModel, ReelsVideoModel

    stmt = (
        select(ReelsCommentModel, ReelsVideoModel)
        .join(ReelsVideoModel, ReelsVideoModel.id == ReelsCommentModel.video_id)
        .where(
            and_(
                ReelsVideoModel.shop_id == shop_id,
                ReelsCommentModel.reported_count > 0,
            )
        )
        .order_by(desc(ReelsCommentModel.reported_count), desc(ReelsCommentModel.created_at))
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return {
        "items": [
            {
                "comment_id": str(c.id),
                "video_id": str(v.id),
                "text": c.comment_text,
                "reported_count": c.reported_count,
                "is_deleted": c.is_deleted,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c, v in rows
        ]
    }


class MerchantModerateCommentBody(BaseModel):
    action: str = Field(default="hide")


@router.post("/merchant/comments/{comment_id}/moderate")
async def merchant_moderate_comment(
    comment_id: UUID,
    body: MerchantModerateCommentBody,
    shop_id: UUID = Depends(require_merchant_shop),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.models.reels import ReelsCommentModel, ReelsVideoModel

    comment = await db.get(ReelsCommentModel, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment topilmadi")
    video = await db.get(ReelsVideoModel, comment.video_id)
    if not video or video.shop_id != shop_id:
        raise HTTPException(status_code=403, detail="Bu comment sizga tegishli emas")

    action = body.action.strip().lower()
    if action not in {"hide", "restore"}:
        raise HTTPException(status_code=400, detail="action hide yoki restore bo'lishi kerak")

    if action == "hide" and not comment.is_deleted:
        comment.is_deleted = True
        comment.deleted_reason = "merchant_hidden"
        comment.deleted_at = datetime.now(timezone.utc)
        video.comments_count = max(0, (video.comments_count or 0) - 1)
    elif action == "restore" and comment.is_deleted:
        comment.is_deleted = False
        comment.deleted_reason = None
        comment.deleted_at = None
        video.comments_count = (video.comments_count or 0) + 1

    await db.commit()
    return {"ok": True, "is_deleted": comment.is_deleted}


# ════════════════════════════════════════════════════════════════
# 4. MERCHANT — Upload
# ════════════════════════════════════════════════════════════════
@router.post("/merchant/upload")
async def merchant_upload_reel(
    video: UploadFile = File(...),
    caption: str | None = Form(default=None),
    hashtags: str = Form(default=""),          # comma-separated
    tagged_product_ids: str = Form(default=""), # comma-separated UUIDs
    thumbnail: UploadFile | None = File(default=None),
    duration_seconds: float | None = Form(default=None),
    shop_id: UUID = Depends(require_merchant_shop),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Merchant video yuklash + mahsulot tagging."""
    if video.content_type not in ("video/mp4", "video/webm", "video/quicktime"):
        raise HTTPException(400, "Faqat MP4 / WebM video qabul qilinadi")

    video_bytes = await video.read()
    if len(video_bytes) > MAX_VIDEO_BYTES:
        raise HTTPException(400, f"Video hajmi {MAX_VIDEO_MB}MB dan oshmasligi kerak")

    thumbnail_bytes: bytes | None = None
    if thumbnail:
        thumbnail_bytes = await thumbnail.read()

    tags = [t.strip() for t in hashtags.split(",") if t.strip()]
    product_ids = [p.strip() for p in tagged_product_ids.split(",") if p.strip()]

    svc = ReelsService(db)
    result = await svc.upload_video(
        shop_id=shop_id,
        video_bytes=video_bytes,
        caption=caption,
        hashtags=tags,
        tagged_product_ids=product_ids,
        content_type=video.content_type or "video/mp4",
        thumbnail_bytes=thumbnail_bytes,
        duration_seconds=duration_seconds,
    )
    return {"status": "uploaded", "video": result}


@router.get("/merchant/my")
async def merchant_my_reels(
    page: int = Query(default=0, ge=0),
    limit: int = Query(default=24, ge=1, le=48),
    shop_id: UUID = Depends(require_merchant_shop),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    svc = ReelsService(db)
    return await svc.get_shop_reels(shop_id, page=page, limit=limit)


@router.delete("/merchant/{video_id}")
async def merchant_delete_reel(
    video_id: UUID,
    shop_id: UUID = Depends(require_merchant_shop),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    svc = ReelsService(db)
    ok = await svc.delete_video(shop_id, video_id)
    if not ok:
        raise HTTPException(404, "Video topilmadi")
    return {"deleted": True}


# ════════════════════════════════════════════════════════════════
# Internal helper
# ════════════════════════════════════════════════════════════════
async def _fetch_products_by_ids(db: AsyncSession, ids: list[str]) -> dict[str, dict]:
    from sqlalchemy import text as sql_text
    if not ids:
        return {}
    try:
        result = await db.execute(
            sql_text("""
                SELECT p.id::text, p.name, p.price, p.images, p.sale_type,
                       s.slug AS shop_slug, s.name AS shop_name
                FROM products p
                LEFT JOIN shops s ON s.id = p.shop_id
                WHERE p.id::text = ANY(:ids) AND p.is_available = true
            """),
            {"ids": ids},
        )
        rows = result.mappings().all()
        return {
            row["id"]: {
                "id": row["id"],
                "name": row["name"],
                "price": int(row["price"]),
                "images": row["images"] or [],
                "sale_type": row["sale_type"],
                "shop_slug": row["shop_slug"],
                "shop_name": row["shop_name"],
            }
            for row in rows
        }
    except Exception:
        return {}
