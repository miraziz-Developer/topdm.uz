"""Viral growth — referral codes, supplier links.

Revision ID: 0037_viral_growth
Revises: 0036_stories_is_active
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0037_viral_growth"
down_revision = "0036_stories_is_active"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("shops", sa.Column("referral_code", sa.String(16), nullable=True))
    op.add_column("shops", sa.Column("referred_by_shop_id", UUID(as_uuid=True), nullable=True))
    op.add_column("shops", sa.Column("referral_rewarded_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_shops_referred_by_shop",
        "shops",
        "shops",
        ["referred_by_shop_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_shops_referral_code", "shops", ["referral_code"], unique=True)

    op.create_table(
        "shop_supplier_links",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("retail_shop_id", UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("supplier_shop_id", UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_supplier_links_retail", "shop_supplier_links", ["retail_shop_id"])
    op.create_index("ix_supplier_links_supplier", "shop_supplier_links", ["supplier_shop_id"])
    op.create_unique_constraint(
        "uq_supplier_link_pair",
        "shop_supplier_links",
        ["retail_shop_id", "supplier_shop_id"],
    )


def downgrade() -> None:
    op.drop_table("shop_supplier_links")
    op.drop_index("ix_shops_referral_code", table_name="shops")
    op.drop_constraint("fk_shops_referred_by_shop", "shops", type_="foreignkey")
    op.drop_column("shops", "referral_rewarded_at")
    op.drop_column("shops", "referred_by_shop_id")
    op.drop_column("shops", "referral_code")
