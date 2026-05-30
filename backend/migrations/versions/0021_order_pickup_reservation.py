"""Pickup reservation fields on orders.

Revision ID: 0021_order_pickup_reservation
Revises: 0020_shop_ratings_crm
"""

from alembic import op
import sqlalchemy as sa

revision = "0021_order_pickup_reservation"
down_revision = "0020_shop_ratings_crm"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("pickup_date", sa.Date(), nullable=True))
    op.add_column("orders", sa.Column("pickup_time", sa.String(length=10), nullable=True))
    op.add_column(
        "orders",
        sa.Column("fulfillment_type", sa.String(length=20), nullable=False, server_default="delivery"),
    )
    op.add_column("orders", sa.Column("customer_email", sa.String(length=255), nullable=True))
    op.create_index("ix_orders_pickup_date", "orders", ["pickup_date"])


def downgrade() -> None:
    op.drop_index("ix_orders_pickup_date", table_name="orders")
    op.drop_column("orders", "customer_email")
    op.drop_column("orders", "fulfillment_type")
    op.drop_column("orders", "pickup_time")
    op.drop_column("orders", "pickup_date")
