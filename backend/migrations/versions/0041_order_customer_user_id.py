"""Buyurtmani foydalanuvchi hisobiga bog'lash (customer_user_id)."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0041_order_customer_user_id"
down_revision = "0040_shop_type_wholesale_pack"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("customer_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_orders_customer_user_id",
        "orders",
        "app_users",
        ["customer_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_orders_customer_user_id", "orders", ["customer_user_id"])


def downgrade() -> None:
    op.drop_index("ix_orders_customer_user_id", table_name="orders")
    op.drop_constraint("fk_orders_customer_user_id", "orders", type_="foreignkey")
    op.drop_column("orders", "customer_user_id")
