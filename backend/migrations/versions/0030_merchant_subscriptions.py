"""Add merchant_subscriptions table for billing plans."""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0030_merchant_subscriptions"
down_revision = "0029_logistics_delivery_core"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "merchant_subscriptions",
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("plan_code", sa.String(length=32), nullable=False, server_default="free"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="free"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("trial_active", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("auto_renew", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_merchant_subscriptions_plan_code", "merchant_subscriptions", ["plan_code"])
    op.create_index("ix_merchant_subscriptions_status", "merchant_subscriptions", ["status"])


def downgrade() -> None:
    op.drop_index("ix_merchant_subscriptions_status", table_name="merchant_subscriptions")
    op.drop_index("ix_merchant_subscriptions_plan_code", table_name="merchant_subscriptions")
    op.drop_table("merchant_subscriptions")
