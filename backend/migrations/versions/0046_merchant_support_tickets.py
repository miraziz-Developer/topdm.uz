"""CRM merchant support tickets (muammo / taklif / savol)."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0046_merchant_support_tickets"
down_revision = "0045_startup_coin_packages"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "merchant_support_tickets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("merchant_phone", sa.String(20), nullable=True),
        sa.Column("merchant_email", sa.String(255), nullable=True),
        sa.Column("category", sa.String(32), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="open"),
        sa.Column("admin_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_merchant_support_tickets_shop_id", "merchant_support_tickets", ["shop_id"])
    op.create_index("ix_merchant_support_tickets_status", "merchant_support_tickets", ["status"])
    op.create_index("ix_merchant_support_tickets_category", "merchant_support_tickets", ["category"])


def downgrade() -> None:
    op.drop_index("ix_merchant_support_tickets_category", table_name="merchant_support_tickets")
    op.drop_index("ix_merchant_support_tickets_status", table_name="merchant_support_tickets")
    op.drop_index("ix_merchant_support_tickets_shop_id", table_name="merchant_support_tickets")
    op.drop_table("merchant_support_tickets")
