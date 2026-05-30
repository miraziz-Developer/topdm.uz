"""Shop coins_balance, coin packages, and payment_transactions for gateway top-ups.

Revision ID: 0018_shop_coins_payment_gateway
Revises: 0017_crm_premium_banner_billing
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0018_shop_coins_payment_gateway"
down_revision = "0017_crm_premium_banner_billing"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "shops",
        sa.Column("coins_balance", sa.Integer(), nullable=False, server_default="0"),
    )

    op.execute(
        """
        UPDATE shops s
        SET coins_balance = COALESCE(w.coin_balance, 0)
        FROM merchant_wallets w
        WHERE w.shop_id = s.id
        """
    )

    op.create_table(
        "coin_packages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(length=32), nullable=False, unique=True),
        sa.Column("name_uz", sa.String(length=120), nullable=False),
        sa.Column("coins", sa.Integer(), nullable=False),
        sa.Column("amount_uzs", sa.Numeric(14, 2), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_coin_packages_code", "coin_packages", ["code"], unique=True)

    op.create_table(
        "payment_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("coin_package_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("coin_packages.id"), nullable=True),
        sa.Column("amount_uzs", sa.Numeric(14, 2), nullable=False),
        sa.Column("coins_added", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("provider_trans_id", sa.String(length=128), nullable=True),
        sa.Column("checkout_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_payment_transactions_shop_id", "payment_transactions", ["shop_id"])
    op.create_index("ix_payment_transactions_status", "payment_transactions", ["status"])
    op.create_index("ix_payment_transactions_provider_trans_id", "payment_transactions", ["provider_trans_id"])

    op.execute(
        """
        INSERT INTO coin_packages (id, code, name_uz, coins, amount_uzs, sort_order)
        VALUES
          ('b1000001-0000-4000-8000-000000000001', 'starter', 'Starter — 50 coin', 50, 500000, 1),
          ('b1000001-0000-4000-8000-000000000002', 'growth', 'Growth — 150 coin', 150, 1200000, 2),
          ('b1000001-0000-4000-8000-000000000003', 'pro', 'Pro — 500 coin', 500, 3500000, 3)
        ON CONFLICT (code) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index("ix_payment_transactions_provider_trans_id", table_name="payment_transactions")
    op.drop_index("ix_payment_transactions_status", table_name="payment_transactions")
    op.drop_index("ix_payment_transactions_shop_id", table_name="payment_transactions")
    op.drop_table("payment_transactions")
    op.drop_index("ix_coin_packages_code", table_name="coin_packages")
    op.drop_table("coin_packages")
    op.drop_column("shops", "coins_balance")
