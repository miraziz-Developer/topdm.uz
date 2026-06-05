"""Merchant debt balance and auto-block for offline pickup commission."""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0032_merchant_debt_auto_block"
down_revision = "0031_topdmbozor_p2p"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "shops",
        sa.Column("debt_balance", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "shops",
        sa.Column("is_blocked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "orders",
        sa.Column("payment_method", sa.String(length=16), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column(
            "debt_commission_recorded",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.create_index("ix_shops_is_blocked", "shops", ["is_blocked"])
    op.create_index("ix_orders_payment_method", "orders", ["payment_method"])


def downgrade() -> None:
    op.drop_index("ix_orders_payment_method", table_name="orders")
    op.drop_index("ix_shops_is_blocked", table_name="shops")
    op.drop_column("orders", "debt_commission_recorded")
    op.drop_column("orders", "payment_method")
    op.drop_column("shops", "is_blocked")
    op.drop_column("shops", "debt_balance")
