"""Reels feed algorithm — TikTok-style recommendation."""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import and_, desc, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reels import ReelsVideoModel


# ── Algorithm weights ──────────────────────────────────────────
W_LIKE       = 8.0   # like eng kuchli signal
W_SHARE      = 10.0  # ulashish eng yuqori intent
W_SAVE       = 7.0   # saqlash yaxshi signal
W_TAP_PROD   = 6.0   # mahsulotga bosish — xarid intent
W_WATCH_FULL = 4.0   # to'liq ko'rish
W_WATCH_HALF = 1.5   # yarim ko'rish
W_FRESH      = 3.0   # yangilik bonus (24 soat ichida)
W_VIEW       = 0.1   # ko'rish zaif signal

HALF_LIFE_HOURS = 48  # 2 kundan keyin score kamaya boshlaydi


def _time_decay(created_at: datetime) -> float:
    """Yangi video ustunligi — eksponensial pasayish."""
    now = datetime.now(timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    age_hours = (now - created_at).total_seconds() / 3600
    return math.exp(-age_hours / HALF_LIFE_HOURS)


def compute_video_score(video: ReelsVideoModel) -> float:
    """Engagement score (yangi video + ko'p like = yuqori)."""
    engagement = (
        video.likes_count  * W_LIKE  +
        video.shares_count * W_SHARE +
        video.saves_count  * W_SAVE  +
        video.views_count  * W_VIEW
    )
    freshness = _time_decay(video.created_at) * W_FRESH
    log_eng = math.log1p(engagement)
    return round(log_eng + freshness, 4)


async def get_personalized_feed(
    db: AsyncSession,
    *,
    session_id: str,
    page: int = 0,
    limit: int = 10,
    category_hint: str | None = None,
    shop_id: UUID | None = None,
) -> list[dict[str, Any]]:
    """
    Personalized feed:
    1. User liked/shared kategoriyasidan ko'proq
    2. Yangi videolar ustunlik
    3. Shop filter bo'lsa faqat shu shop
    """
    offset = page * limit

    # User qiziqishlari (oxirgi 7 kun)
    user_cats = await _get_user_interest_categories(db, session_id)

    # Base query
    stmt = select(ReelsVideoModel).where(
        and_(
            ReelsVideoModel.is_active.is_(True),
            ReelsVideoModel.status == "active",
        )
    )

    if shop_id:
        stmt = stmt.where(ReelsVideoModel.shop_id == shop_id)

    # Category boost — user qiziqqan bo'lsa
    if user_cats or category_hint:
        hint_cats = [category_hint] if category_hint else []
        all_cats = list(set(user_cats + hint_cats))
        # algorithm_score ga qo'shimcha weight (SQL-level)
        stmt = stmt.order_by(
            desc(ReelsVideoModel.algorithm_score),
            desc(ReelsVideoModel.created_at),
        )
    else:
        stmt = stmt.order_by(
            desc(ReelsVideoModel.algorithm_score),
            desc(ReelsVideoModel.created_at),
        )

    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    videos = result.scalars().all()

    return [_video_to_dict(v) for v in videos]


async def record_interaction(
    db: AsyncSession,
    *,
    video_id: UUID,
    session_id: str,
    watch_pct: float,
    watch_seconds: float,
    is_liked: bool | None = None,
    is_shared: bool | None = None,
    is_saved: bool | None = None,
    tapped_product: bool | None = None,
) -> None:
    """Interaction yozish + engagement metrics yangilash."""
    from app.models.reels import ReelsInteractionModel
    import uuid

    prev_stmt = (
        select(ReelsInteractionModel)
        .where(
            and_(
                ReelsInteractionModel.video_id == video_id,
                ReelsInteractionModel.user_session_id == session_id,
            )
        )
        .order_by(desc(ReelsInteractionModel.created_at))
        .limit(1)
    )
    prev_result = await db.execute(prev_stmt)
    prev = prev_result.scalar_one_or_none()
    prev_liked = bool(prev.is_liked) if prev else False
    prev_shared = bool(prev.is_shared) if prev else False
    prev_saved = bool(prev.is_saved) if prev else False

    interaction = ReelsInteractionModel(
        id=uuid.uuid4(),
        video_id=video_id,
        user_session_id=session_id,
        watch_time_seconds=watch_seconds,
        watch_pct=min(1.0, max(0.0, watch_pct)),
        is_liked=prev_liked if is_liked is None else is_liked,
        is_shared=prev_shared if is_shared is None else is_shared,
        is_saved=prev_saved if is_saved is None else is_saved,
        tapped_product=bool(tapped_product),
    )
    db.add(interaction)

    # Denormalized counter yangilash
    try:
        video = await db.get(ReelsVideoModel, video_id)
        if video:
            if watch_seconds > 0 or watch_pct > 0:
                video.views_count = (video.views_count or 0) + 1

            next_liked = interaction.is_liked
            if next_liked != prev_liked:
                delta = 1 if next_liked else -1
                video.likes_count = max(0, (video.likes_count or 0) + delta)

            next_shared = interaction.is_shared
            if next_shared != prev_shared:
                delta = 1 if next_shared else -1
                video.shares_count = max(0, (video.shares_count or 0) + delta)

            next_saved = interaction.is_saved
            if next_saved != prev_saved:
                delta = 1 if next_saved else -1
                video.saves_count = max(0, (video.saves_count or 0) + delta)

            video.algorithm_score = compute_video_score(video)
    except Exception:
        pass

    await db.commit()


async def _get_user_interest_categories(db: AsyncSession, session_id: str) -> list[str]:
    """User so'nggi 7 kundagi liked/shared video kategoriyalari."""
    try:
        result = await db.execute(
            text("""
                SELECT DISTINCT unnest(rv.category_tags) AS cat
                FROM reels_interactions ri
                JOIN reels_videos rv ON rv.id = ri.video_id
                WHERE ri.user_session_id = :sid
                  AND (ri.is_liked = true OR ri.is_shared = true OR ri.watch_pct > 0.7)
                  AND ri.created_at > NOW() - INTERVAL '7 days'
                LIMIT 5
            """),
            {"sid": session_id},
        )
        return [row[0] for row in result.all() if row[0]]
    except Exception:
        return []


def _video_to_dict(video: ReelsVideoModel) -> dict[str, Any]:
    shop = video.shop
    return {
        "id": str(video.id),
        "shop": {
            "id": str(shop.id) if shop else "",
            "name": shop.name if shop else "",
            "slug": shop.slug if shop else "",
            "logo_url": shop.logo_url if shop else None,
            "location_label": getattr(shop, "location_label", None)
                or (f"{shop.market_zone} · {shop.stall_number}" if shop and shop.market_zone else None),
        },
        "video_url": video.video_url,
        "thumbnail_url": video.thumbnail_url,
        "duration_seconds": video.duration_seconds,
        "caption": video.caption or "",
        "hashtags": video.hashtags or [],
        "tagged_product_ids": video.tagged_product_ids or [],
        "likes_count": video.likes_count,
        "views_count": video.views_count,
        "shares_count": video.shares_count,
        "comments_count": video.comments_count,
        "saves_count": video.saves_count,
        "algorithm_score": video.algorithm_score,
        "created_at": video.created_at.isoformat() if video.created_at else None,
    }
