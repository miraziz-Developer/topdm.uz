"""Merchant live stories (24h TTL).

Revision ID: 0014_merchant_stories
Revises: 0013_hybrid_sale_type
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0014_merchant_stories"
down_revision = "0013_hybrid_sale_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("image_url", sa.Text(), nullable=False),
        sa.Column("level_context", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_stories_shop_id", "stories", ["shop_id"])
    op.create_index("ix_stories_expires_at", "stories", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_stories_expires_at", table_name="stories")
    op.drop_index("ix_stories_shop_id", table_name="stories")
    op.drop_table("stories")
