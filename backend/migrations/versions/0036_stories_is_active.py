"""Stories — is_active flag (soft hide + GC).

Revision ID: 0036_stories_is_active
Revises: 0035_shops_telegram_chat_id_bigint
"""

from alembic import op
import sqlalchemy as sa

revision = "0036_stories_is_active"
down_revision = "0035_shops_telegram_chat_id_bigint"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "stories",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.create_index("ix_stories_shop_active", "stories", ["shop_id", "is_active", "expires_at"])


def downgrade() -> None:
    op.drop_index("ix_stories_shop_active", table_name="stories")
    op.drop_column("stories", "is_active")
