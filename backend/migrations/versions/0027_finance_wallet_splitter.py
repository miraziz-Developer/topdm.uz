"""Finance: merchant settlement wallets and platform order splits."""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0027_finance_wallet_splitter"
down_revision = "0026_reels_comment_moderation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "finance_merchant_wallets",
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("current_balance", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("frozen_balance", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "platform_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("total_amount_received", sa.Numeric(12, 2), nullable=False),
        sa.Column("product_subtotal", sa.Numeric(12, 2), nullable=False),
        sa.Column("merchant_share", sa.Numeric(12, 2), nullable=False),
        sa.Column("delivery_share", sa.Numeric(12, 2), nullable=False),
        sa.Column("platform_commission", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="held_in_escrow"),
        sa.Column("gateway_provider", sa.String(32), nullable=True),
        sa.Column("gateway_reference", sa.String(128), nullable=True),
        sa.Column("idempotency_key", sa.String(128), nullable=True),
        sa.Column("billing_snapshot", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_platform_transactions_order_id", "platform_transactions", ["order_id"], unique=True)
    op.create_index("ix_platform_transactions_shop_id", "platform_transactions", ["shop_id"])
    op.create_index("ix_platform_transactions_status", "platform_transactions", ["status"])
    op.create_index("ix_platform_transactions_gateway_reference", "platform_transactions", ["gateway_reference"])
    op.create_index("ix_platform_transactions_idempotency_key", "platform_transactions", ["idempotency_key"], unique=True)


def downgrade() -> None:
    op.drop_table("platform_transactions")
    op.drop_table("finance_merchant_wallets")
