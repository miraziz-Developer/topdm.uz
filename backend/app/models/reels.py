"""Bozorliii.uz Reels — TikTok Shop uslubidagi video commerce."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import ARRAY, BOOLEAN, BigInteger, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.base import Base


class ReelsVideoModel(Base):
    __tablename__ = "reels_videos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shop_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Video storage
    video_url: Mapped[str] = mapped_column(Text, nullable=False)
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    aspect_ratio: Mapped[str] = mapped_column(String(10), nullable=False, default="9:16")

    # Content
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    hashtags: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)

    # Tagged products — stored as ordered list of product UUIDs
    tagged_product_ids: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)

    # Engagement metrics (denormalized for speed)
    views_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    likes_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    shares_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    comments_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    saves_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    # Algorithm score (pre-computed, updated by background job)
    algorithm_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default="0")
    category_tags: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)

    # Status
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="processing")
    # processing | active | hidden | deleted
    is_active: Mapped[bool] = mapped_column(BOOLEAN, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    shop = relationship("ShopModel", lazy="joined")


class ReelsInteractionModel(Base):
    """User xatti-harakatlari — tavsiya algoritmiga input."""
    __tablename__ = "reels_interactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reels_videos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_session_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    # registered user yoki guest

    watch_time_seconds: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    watch_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)  # 0-1.0
    is_liked: Mapped[bool] = mapped_column(BOOLEAN, nullable=False, default=False)
    is_shared: Mapped[bool] = mapped_column(BOOLEAN, nullable=False, default=False)
    is_saved: Mapped[bool] = mapped_column(BOOLEAN, nullable=False, default=False)
    tapped_product: Mapped[bool] = mapped_column(BOOLEAN, nullable=False, default=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="feed")
    # feed | profile | search | share_link

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )


class ReelsCommentModel(Base):
    """Reels comments from customers."""

    __tablename__ = "reels_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reels_videos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_session_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    comment_text: Mapped[str] = mapped_column(Text, nullable=False)
    reported_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    is_deleted: Mapped[bool] = mapped_column(BOOLEAN, nullable=False, default=False, server_default="false")
    deleted_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )


class ReelsCommentReportModel(Base):
    """Reports from customers for moderation."""

    __tablename__ = "reels_comment_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    comment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reels_comments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reels_videos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_session_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    reason: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
