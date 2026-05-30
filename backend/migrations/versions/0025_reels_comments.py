"""Add reels comments table."""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0025_reels_comments"
down_revision = "0024_reels_video_commerce"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "reels_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "video_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("reels_videos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_session_id", sa.String(128), nullable=False),
        sa.Column("comment_text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_reels_comments_video_id", "reels_comments", ["video_id"])
    op.create_index("ix_reels_comments_session_id", "reels_comments", ["user_session_id"])
    op.create_index("ix_reels_comments_created_at", "reels_comments", ["created_at"])


def downgrade() -> None:
    op.drop_table("reels_comments")
