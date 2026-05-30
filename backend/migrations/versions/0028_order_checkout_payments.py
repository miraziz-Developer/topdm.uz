"""Order checkout payments for Click / Payme customer pickup."""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0028_order_checkout_payments"
down_revision = "0027_finance_wallet_splitter"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "order_checkout_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("order_ids", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("amount_uzs", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("provider_trans_id", sa.String(length=128), nullable=True),
        sa.Column("customer_phone", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("meta", postgresql.JSONB(), nullable=False, server_default="{}"),
    )
    op.create_index("ix_order_checkout_payments_status", "order_checkout_payments", ["status"])
    op.create_index("ix_order_checkout_payments_provider", "order_checkout_payments", ["provider"])
    op.create_index(
        "ix_order_checkout_payments_provider_trans_id",
        "order_checkout_payments",
        ["provider_trans_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_order_checkout_payments_provider_trans_id", table_name="order_checkout_payments")
    op.drop_index("ix_order_checkout_payments_provider", table_name="order_checkout_payments")
    op.drop_index("ix_order_checkout_payments_status", table_name="order_checkout_payments")
    op.drop_table("order_checkout_payments")
