"""Merchant self-registration: credentials + shop storefront fields."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0023_merchant_self_registration"
down_revision = "0022_product_stock_count"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("shops", sa.Column("stall_number", sa.String(length=32), nullable=True))
    op.add_column("shops", sa.Column("storefront_image_url", sa.Text(), nullable=True))
    op.add_column("shops", sa.Column("owner_display_name", sa.String(length=120), nullable=True))
    op.add_column(
        "shops",
        sa.Column("registration_source", sa.String(length=32), nullable=False, server_default="admin"),
    )

    op.create_table(
        "merchant_credentials",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("shop_id", sa.UUID(), nullable=False),
        sa.Column("login_code", sa.String(length=32), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("shop_id"),
        sa.UniqueConstraint("login_code"),
    )
    op.create_index("ix_merchant_credentials_login_code", "merchant_credentials", ["login_code"])


def downgrade() -> None:
    op.drop_index("ix_merchant_credentials_login_code", table_name="merchant_credentials")
    op.drop_table("merchant_credentials")
    op.drop_column("shops", "registration_source")
    op.drop_column("shops", "owner_display_name")
    op.drop_column("shops", "storefront_image_url")
    op.drop_column("shops", "stall_number")
