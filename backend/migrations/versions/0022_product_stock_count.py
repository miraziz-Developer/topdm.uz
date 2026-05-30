"""Product stock_count for reservation inventory locking.

Revision ID: 0022_product_stock_count
Revises: 0021_order_pickup_reservation
"""

from alembic import op
import sqlalchemy as sa

revision = "0022_product_stock_count"
down_revision = "0021_order_pickup_reservation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("stock_count", sa.Integer(), nullable=False, server_default="5"),
    )
    op.execute(
        """
        UPDATE products
        SET stock_count = CASE
            WHEN is_available = TRUE THEN GREATEST(1, 5)
            ELSE 0
        END
        """
    )
    op.alter_column("products", "stock_count", server_default=None)


def downgrade() -> None:
    op.drop_column("products", "stock_count")
