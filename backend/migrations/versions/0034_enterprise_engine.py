"""Enterprise engine: campaigns, business rules, transaction ledger, checkout purpose."""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0034_enterprise_engine"
down_revision = "0033_product_reviews"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "business_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("rule_key", sa.String(length=64), nullable=False),
        sa.Column("rule_value", sa.Text(), nullable=False),
        sa.Column("scope", sa.String(length=32), nullable=False, server_default="global"),
        sa.Column("scope_ref_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("rule_key", "scope", "scope_ref_id", name="uq_business_rules_key_scope"),
    )
    op.create_index("ix_business_rules_rule_key", "business_rules", ["rule_key"])
    op.create_index("ix_business_rules_active", "business_rules", ["is_active"])

    op.create_table(
        "flash_sales",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("discount_rate", sa.Numeric(6, 4), nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("stock_limit", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sold_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_flash_sales_product_id", "flash_sales", ["product_id"])
    op.create_index("ix_flash_sales_window", "flash_sales", ["start_time", "end_time"])
    op.create_index("ix_flash_sales_active", "flash_sales", ["is_active"])

    op.create_table(
        "lightning_deals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("discount_rate", sa.Numeric(6, 4), nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("stock_limit", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sold_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_lightning_deals_product_id", "lightning_deals", ["product_id"])
    op.create_index("ix_lightning_deals_window", "lightning_deals", ["start_time", "end_time"])
    op.create_index("ix_lightning_deals_active", "lightning_deals", ["is_active"])

    op.create_table(
        "transaction_ledger",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entry_type", sa.String(length=16), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("amount_uzs", sa.Integer(), nullable=False),
        sa.Column("balance_after_uzs", sa.Integer(), nullable=False),
        sa.Column("reference_type", sa.String(length=32), nullable=True),
        sa.Column("reference_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("meta", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("idempotency_key", name="uq_transaction_ledger_idempotency"),
    )
    op.create_index("ix_transaction_ledger_shop_id", "transaction_ledger", ["shop_id"])
    op.create_index("ix_transaction_ledger_reference", "transaction_ledger", ["reference_type", "reference_id"])
    op.create_index("ix_transaction_ledger_created_at", "transaction_ledger", ["created_at"])

    op.add_column(
        "order_checkout_payments",
        sa.Column("purpose", sa.String(length=32), nullable=False, server_default="order"),
    )
    op.add_column(
        "order_checkout_payments",
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_order_checkout_payments_purpose", "order_checkout_payments", ["purpose"])
    op.create_index("ix_order_checkout_payments_shop_id", "order_checkout_payments", ["shop_id"])

    op.execute("UPDATE product_reviews SET status = 'approved' WHERE status = 'published'")

    op.execute(
        """
        INSERT INTO business_rules (id, rule_key, rule_value, scope, scope_ref_id, is_active, description)
        VALUES
          ('00000000-0000-4000-8000-000000000001', 'group_discount_rate', '0.267', 'global', NULL, true, 'Guruh narxi chegirma foizi (0–1)'),
          ('00000000-0000-4000-8000-000000000002', 'platform_product_markup_pct', '15', 'global', NULL, true, 'Platforma mahsulot ustamasi foizi'),
          ('00000000-0000-4000-8000-000000000003', 'merchant_debt_block_threshold_uzs', '100000', 'global', NULL, true, 'Qarz bloklash limiti (UZS)')
        ON CONFLICT DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index("ix_order_checkout_payments_shop_id", table_name="order_checkout_payments")
    op.drop_index("ix_order_checkout_payments_purpose", table_name="order_checkout_payments")
    op.drop_column("order_checkout_payments", "shop_id")
    op.drop_column("order_checkout_payments", "purpose")
    op.drop_table("transaction_ledger")
    op.drop_table("lightning_deals")
    op.drop_table("flash_sales")
    op.drop_table("business_rules")
    op.execute("UPDATE product_reviews SET status = 'published' WHERE status = 'approved'")
