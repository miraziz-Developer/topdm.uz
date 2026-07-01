"""Mijoz Bozor Coin — app_users balansi va buyurtma coin maydonlari."""

from alembic import op
import sqlalchemy as sa

revision = "0049_customer_loyalty_coins"
down_revision = "0048_merchant_support_faq"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "app_users",
        sa.Column("coins_balance", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "orders",
        sa.Column("loyalty_coins_redeemed", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "orders",
        sa.Column("loyalty_coins_awarded", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("orders", "loyalty_coins_awarded")
    op.drop_column("orders", "loyalty_coins_redeemed")
    op.drop_column("app_users", "coins_balance")
