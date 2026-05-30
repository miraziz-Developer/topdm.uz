"""CRM billing: banner status lifecycle, payment transactions, merchant wallets.

Revision ID: 0017_crm_premium_banner_billing
Revises: 0016_premium_sponsored_banners
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0017_crm_premium_banner_billing"
down_revision = "0016_premium_sponsored_banners"
branch_labels = None
depends_on = None

BANNER_STATUS = ("pending_payment", "active", "expired", "cancelled")


def upgrade() -> None:
    op.add_column(
        "premium_tariffs",
        sa.Column("duration_days", sa.Integer(), nullable=False, server_default="30"),
    )
    op.execute("UPDATE premium_tariffs SET duration_days = 1 WHERE code = 'bronze'")
    op.execute("UPDATE premium_tariffs SET duration_days = 7 WHERE code = 'silver'")
    op.execute("UPDATE premium_tariffs SET duration_days = 30 WHERE code = 'gold'")

    op.add_column(
        "sponsored_banners",
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
    )
    op.add_column("sponsored_banners", sa.Column("package_days", sa.Integer(), nullable=True))
    op.add_column("sponsored_banners", sa.Column("queue_position", sa.Integer(), nullable=True))
    op.add_column(
        "sponsored_banners",
        sa.Column("amount_uzs", sa.Numeric(14, 2), nullable=True),
    )
    op.add_column("sponsored_banners", sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "sponsored_banners",
        sa.Column("payment_method", sa.String(length=32), nullable=True),
    )

    op.execute(
        """
        UPDATE sponsored_banners
        SET status = CASE
            WHEN is_active = false THEN 'cancelled'
            WHEN ends_at <= NOW() THEN 'expired'
            ELSE 'active'
        END
        """
    )

    op.create_index("ix_sponsored_banners_status", "sponsored_banners", ["status"])
    op.create_index("ix_sponsored_banners_shop_status", "sponsored_banners", ["shop_id", "status"])

    op.create_table(
        "merchant_wallets",
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("coin_balance", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "banner_payment_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("banner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sponsored_banners.id", ondelete="CASCADE"), nullable=False),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tariff_code", sa.String(length=32), nullable=False),
        sa.Column("amount_uzs", sa.Numeric(14, 2), nullable=False),
        sa.Column("coin_amount", sa.Integer(), nullable=True),
        sa.Column("payment_method", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="completed"),
        sa.Column("external_reference", sa.String(length=128), nullable=True),
        sa.Column("transaction_timestamp", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("metadata_json", sa.Text(), nullable=True),
    )
    op.create_index("ix_banner_payment_tx_banner", "banner_payment_transactions", ["banner_id"])
    op.create_index("ix_banner_payment_tx_shop", "banner_payment_transactions", ["shop_id"])
    op.create_index("ix_banner_payment_tx_ts", "banner_payment_transactions", ["transaction_timestamp"])


def downgrade() -> None:
    op.drop_index("ix_banner_payment_tx_ts", table_name="banner_payment_transactions")
    op.drop_index("ix_banner_payment_tx_shop", table_name="banner_payment_transactions")
    op.drop_index("ix_banner_payment_tx_banner", table_name="banner_payment_transactions")
    op.drop_table("banner_payment_transactions")
    op.drop_table("merchant_wallets")
    op.drop_index("ix_sponsored_banners_shop_status", table_name="sponsored_banners")
    op.drop_index("ix_sponsored_banners_status", table_name="sponsored_banners")
    op.drop_column("sponsored_banners", "payment_method")
    op.drop_column("sponsored_banners", "paid_at")
    op.drop_column("sponsored_banners", "amount_uzs")
    op.drop_column("sponsored_banners", "queue_position")
    op.drop_column("sponsored_banners", "package_days")
    op.drop_column("sponsored_banners", "status")
    op.drop_column("premium_tariffs", "duration_days")
