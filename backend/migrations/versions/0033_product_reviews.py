"""Product reviews with star ratings and buyer photos."""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0033_product_reviews"
down_revision = "0032_merchant_debt_auto_block"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "product_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app_users.id"), nullable=True),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id"), nullable=True),
        sa.Column("customer_phone", sa.String(length=20), nullable=True),
        sa.Column("author_name", sa.String(length=80), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("photo_urls", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"),
        sa.Column("is_verified_purchase", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="published"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_product_reviews_product_id", "product_reviews", ["product_id"])
    op.create_index("ix_product_reviews_shop_id", "product_reviews", ["shop_id"])
    op.create_index("ix_product_reviews_rating", "product_reviews", ["rating"])


def downgrade() -> None:
    op.drop_index("ix_product_reviews_rating", table_name="product_reviews")
    op.drop_index("ix_product_reviews_shop_id", table_name="product_reviews")
    op.drop_index("ix_product_reviews_product_id", table_name="product_reviews")
    op.drop_table("product_reviews")
