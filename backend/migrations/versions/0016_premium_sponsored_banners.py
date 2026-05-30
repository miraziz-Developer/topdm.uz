"""Premium tariff tiers and sponsored home banners.

Revision ID: 0016_premium_sponsored_banners
Revises: 0015_product_visual_embedding
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0016_premium_sponsored_banners"
down_revision = "0015_product_visual_embedding"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "premium_tariffs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(length=32), nullable=False, unique=True),
        sa.Column("name_uz", sa.String(length=120), nullable=False),
        sa.Column("name_ru", sa.String(length=120), nullable=True),
        sa.Column("priority_weight", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("dwell_ms", sa.Integer(), nullable=False, server_default="4500"),
        sa.Column("badge_label", sa.String(length=40), nullable=True),
        sa.Column("frame_style", sa.String(length=32), nullable=False, server_default="standard"),
        sa.Column("price_uzs_monthly", sa.Numeric(14, 2), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_premium_tariffs_code", "premium_tariffs", ["code"], unique=True)

    op.create_table(
        "sponsored_banners",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tariff_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("premium_tariffs.id"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="SET NULL"), nullable=True),
        sa.Column("cta_path", sa.String(length=512), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("impression_count", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("click_count", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_sponsored_banners_shop_id", "sponsored_banners", ["shop_id"])
    op.create_index("ix_sponsored_banners_ends_at", "sponsored_banners", ["ends_at"])
    op.create_index("ix_sponsored_banners_active_window", "sponsored_banners", ["is_active", "starts_at", "ends_at"])

    op.execute(
        """
        INSERT INTO premium_tariffs (id, code, name_uz, name_ru, priority_weight, dwell_ms, badge_label, frame_style, price_uzs_monthly)
        VALUES
          ('a0000001-0000-4000-8000-000000000001', 'bronze', 'Bronze', 'Бронза', 1, 4500, NULL, 'standard', 500000),
          ('a0000001-0000-4000-8000-000000000002', 'silver', 'Silver', 'Серебро', 2, 5000, 'Silver', 'silver_glow', 1500000),
          ('a0000001-0000-4000-8000-000000000003', 'gold', 'Gold VIP', 'Gold VIP', 3, 5500, 'VIP Gold', 'gold_neon', 4500000)
        ON CONFLICT (code) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index("ix_sponsored_banners_active_window", table_name="sponsored_banners")
    op.drop_index("ix_sponsored_banners_ends_at", table_name="sponsored_banners")
    op.drop_index("ix_sponsored_banners_shop_id", table_name="sponsored_banners")
    op.drop_table("sponsored_banners")
    op.drop_index("ix_premium_tariffs_code", table_name="premium_tariffs")
    op.drop_table("premium_tariffs")
