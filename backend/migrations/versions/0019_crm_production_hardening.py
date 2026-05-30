"""CRM production: coin_cost, CTR column, idempotency, expiration notifications.

Revision ID: 0019_crm_production_hardening
Revises: 0018_shop_coins_payment_gateway
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0019_crm_production_hardening"
down_revision = "0018_shop_coins_payment_gateway"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("premium_tariffs", sa.Column("coin_cost", sa.Integer(), nullable=True))
    op.execute("UPDATE premium_tariffs SET coin_cost = 36 WHERE code = 'bronze'")
    op.execute("UPDATE premium_tariffs SET coin_cost = 72 WHERE code = 'silver'")
    op.execute("UPDATE premium_tariffs SET coin_cost = 108 WHERE code = 'gold'")

    op.add_column(
        "sponsored_banners",
        sa.Column("ctr_percent", sa.Numeric(8, 4), nullable=False, server_default="0"),
    )
    op.add_column("sponsored_banners", sa.Column("coins_spent", sa.Integer(), nullable=True))
    op.add_column("sponsored_banners", sa.Column("expired_notified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("sponsored_banners", sa.Column("rejection_reason", sa.String(length=255), nullable=True))

    op.add_column("payment_transactions", sa.Column("idempotency_key", sa.String(length=128), nullable=True))
    op.create_index(
        "ix_payment_transactions_idempotency",
        "payment_transactions",
        ["idempotency_key"],
        unique=True,
        postgresql_where=sa.text("idempotency_key IS NOT NULL"),
    )
    op.create_index(
        "ix_payment_transactions_provider_trans_unique",
        "payment_transactions",
        ["provider", "provider_trans_id"],
        unique=True,
        postgresql_where=sa.text("provider_trans_id IS NOT NULL"),
    )

    op.create_table(
        "merchant_crm_notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("banner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sponsored_banners.id", ondelete="SET NULL"), nullable=True),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_merchant_crm_notifications_shop", "merchant_crm_notifications", ["shop_id"])


def downgrade() -> None:
    op.drop_index("ix_merchant_crm_notifications_shop", table_name="merchant_crm_notifications")
    op.drop_table("merchant_crm_notifications")
    op.drop_index("ix_payment_transactions_provider_trans_unique", table_name="payment_transactions")
    op.drop_index("ix_payment_transactions_idempotency", table_name="payment_transactions")
    op.drop_column("payment_transactions", "idempotency_key")
    op.drop_column("sponsored_banners", "rejection_reason")
    op.drop_column("sponsored_banners", "expired_notified_at")
    op.drop_column("sponsored_banners", "coins_spent")
    op.drop_column("sponsored_banners", "ctr_percent")
    op.drop_column("premium_tariffs", "coin_cost")
