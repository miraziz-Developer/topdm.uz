"""Chat thread read cursors for unread message counts."""

from alembic import op
import sqlalchemy as sa

revision = "0044_chat_read_cursors"
down_revision = "0043_platform_profit_sweeps"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "chat_threads",
        sa.Column("merchant_last_read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "chat_threads",
        sa.Column("customer_last_read_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("chat_threads", "customer_last_read_at")
    op.drop_column("chat_threads", "merchant_last_read_at")
