"""Drop topdmbozor.uz P2P + SMS pilot marketplace tables."""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0042_drop_topdmbozor"
down_revision = "0041_order_customer_user_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("tdb_orders")
    op.drop_table("tdb_merchants")
    op.drop_table("tdb_users")
    op.execute("DROP TYPE IF EXISTS tdb_order_status")
    op.execute("DROP TYPE IF EXISTS tdb_delivery_status")


def downgrade() -> None:
    op.create_table(
        "tdb_users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("username", sa.String(length=64), nullable=True),
        sa.Column("phone_number", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_tdb_users_phone_number", "tdb_users", ["phone_number"], unique=True)
    op.create_index("ix_tdb_users_username", "tdb_users", ["username"])

    op.create_table(
        "tdb_merchants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tdb_users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("shop_name", sa.String(length=255), nullable=False),
        sa.Column("card_number", sa.String(length=32), nullable=False),
        sa.Column("balance", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("frozen_balance", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_tdb_merchants_user_id", "tdb_merchants", ["user_id"])

    op.create_table(
        "tdb_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tdb_users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("merchant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tdb_merchants.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "paid", "completed", "canceled", name="tdb_order_status", native_enum=False),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "delivery_status",
            sa.Enum("pending", "shipped", "delivered", name="tdb_delivery_status", native_enum=False),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("tracking_number", sa.String(length=64), nullable=True),
        sa.Column("click_p2p_url", sa.String(length=512), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_tdb_orders_user_id", "tdb_orders", ["user_id"])
    op.create_index("ix_tdb_orders_merchant_id", "tdb_orders", ["merchant_id"])
    op.create_index("ix_tdb_orders_status", "tdb_orders", ["status"])
    op.create_index("ix_tdb_orders_delivery_status", "tdb_orders", ["delivery_status"])
    op.create_index("ix_tdb_orders_tracking_number", "tdb_orders", ["tracking_number"])
