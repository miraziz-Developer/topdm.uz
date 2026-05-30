"""merchant pending product submissions (telegram / CRM moderation)

Revision ID: 0006_merchant_pending_products
Revises: 0005_shop_precision_location
Create Date: 2026-05-15
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0006_merchant_pending_products"
down_revision = "0005_shop_precision_location"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "merchant_pending_products",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("shop_id", UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("telegram_user_id", sa.BigInteger(), nullable=True),
        sa.Column("telegram_chat_id", sa.BigInteger(), nullable=True),
        sa.Column("telegram_file_id", sa.String(length=256), nullable=True),
        sa.Column("vision_attributes", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_merchant_pending_products_shop_id", "merchant_pending_products", ["shop_id"])
    op.create_index("ix_merchant_pending_products_status", "merchant_pending_products", ["status"])


def downgrade() -> None:
    op.drop_index("ix_merchant_pending_products_status", table_name="merchant_pending_products")
    op.drop_index("ix_merchant_pending_products_shop_id", table_name="merchant_pending_products")
    op.drop_table("merchant_pending_products")
