"""Hybrid wholesale/retail pricing on products.

Revision ID: 0013_hybrid_sale_type
Revises: 0012_app_users_display_name
"""

from alembic import op
import sqlalchemy as sa

revision = "0013_hybrid_sale_type"
down_revision = "0012_app_users_display_name"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("sale_type", sa.String(length=16), nullable=False, server_default="Chakana"),
    )
    op.add_column(
        "products",
        sa.Column("min_order_quantity", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_index("ix_products_sale_type", "products", ["sale_type"])
    op.add_column("shops", sa.Column("market_zone", sa.String(length=64), nullable=True))
    op.add_column("shops", sa.Column("block_sector", sa.String(length=120), nullable=True))
    op.create_index("ix_shops_market_zone", "shops", ["market_zone"])


def downgrade() -> None:
    op.drop_index("ix_shops_market_zone", table_name="shops")
    op.drop_column("shops", "block_sector")
    op.drop_column("shops", "market_zone")
    op.drop_index("ix_products_sale_type", table_name="products")
    op.drop_column("products", "min_order_quantity")
    op.drop_column("products", "sale_type")
