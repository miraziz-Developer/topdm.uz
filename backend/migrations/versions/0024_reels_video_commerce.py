"""Reels video commerce — TikTok Shop uslubida."""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0024_reels_video_commerce"
down_revision = "0023_merchant_self_registration"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "reels_videos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("video_url", sa.Text(), nullable=False),
        sa.Column("thumbnail_url", sa.Text(), nullable=True),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("aspect_ratio", sa.String(10), nullable=False, server_default="9:16"),
        sa.Column("caption", sa.Text(), nullable=True),
        sa.Column("hashtags", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"),
        sa.Column("tagged_product_ids", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"),
        sa.Column("views_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("likes_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("shares_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("comments_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("saves_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("algorithm_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("category_tags", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_reels_videos_shop_id", "reels_videos", ["shop_id"])
    op.create_index("ix_reels_videos_created_at", "reels_videos", ["created_at"])
    op.create_index("ix_reels_videos_algorithm_score", "reels_videos", ["algorithm_score"])

    op.create_table(
        "reels_interactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("video_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("reels_videos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_session_id", sa.String(128), nullable=False),
        sa.Column("watch_time_seconds", sa.Float(), nullable=False, server_default="0"),
        sa.Column("watch_pct", sa.Float(), nullable=False, server_default="0"),
        sa.Column("is_liked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_shared", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_saved", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("tapped_product", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("source", sa.String(32), nullable=False, server_default="feed"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_reels_interactions_video_id", "reels_interactions", ["video_id"])
    op.create_index("ix_reels_interactions_session", "reels_interactions", ["user_session_id"])


def downgrade() -> None:
    op.drop_table("reels_interactions")
    op.drop_table("reels_videos")
