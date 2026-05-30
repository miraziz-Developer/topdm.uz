"""Reels comments moderation fields and reports."""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0026_reels_comment_moderation"
down_revision = "0025_reels_comments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("reels_comments", sa.Column("reported_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("reels_comments", sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("reels_comments", sa.Column("deleted_reason", sa.String(length=64), nullable=True))
    op.add_column("reels_comments", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "reels_comment_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "comment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("reels_comments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "video_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("reels_videos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_session_id", sa.String(128), nullable=False),
        sa.Column("reason", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_reels_comment_reports_comment_id", "reels_comment_reports", ["comment_id"])
    op.create_index("ix_reels_comment_reports_video_id", "reels_comment_reports", ["video_id"])
    op.create_index("ix_reels_comment_reports_session_id", "reels_comment_reports", ["user_session_id"])
    op.create_index(
        "ux_reels_comment_reports_once_per_session",
        "reels_comment_reports",
        ["comment_id", "user_session_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("reels_comment_reports")
    op.drop_column("reels_comments", "deleted_at")
    op.drop_column("reels_comments", "deleted_reason")
    op.drop_column("reels_comments", "is_deleted")
    op.drop_column("reels_comments", "reported_count")
