"""Publish product reviews stuck in pending_moderation."""

from __future__ import annotations

from alembic import op

revision = "0038_publish_pending_reviews"
down_revision = "0037_viral_growth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "UPDATE product_reviews SET status = 'approved' WHERE status = 'pending_moderation'"
    )


def downgrade() -> None:
    pass
