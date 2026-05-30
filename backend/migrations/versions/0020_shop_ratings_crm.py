"""Shop reviews + trust_metrics JSONB for CRM and storefront cards.

Revision ID: 0020_shop_ratings_crm
Revises: 0019_crm_production_hardening
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0020_shop_ratings_crm"
down_revision = "0019_crm_production_hardening"
branch_labels = None
depends_on = None

DEFAULT_TRUST_JSON = (
    '\'{"on_time_delivery_pct": 98, "quality_guarantee": true, '
    '"response_time_hours": 2.5, "badges": ["quality_guarantee", "on_time_delivery"], '
    '"rating_distribution": {"5": 98, "4": 20, "3": 4, "2": 1, "1": 1}}\'::jsonb'
)


def upgrade() -> None:
    op.add_column(
        "shops",
        sa.Column("review_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "shops",
        sa.Column(
            "trust_metrics",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    op.create_table(
        "shop_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app_users.id"), nullable=True),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("is_verified_purchase", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("merchant_reply", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="published"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_shop_reviews_shop_id", "shop_reviews", ["shop_id"])
    op.create_index("ix_shop_reviews_shop_status", "shop_reviews", ["shop_id", "status"])

    # Seed featured shops with demo trust block (incl. Anor Boutique)
    op.execute(
        f"""
        UPDATE shops
        SET
          review_count = CASE WHEN slug = 'anor-boutique' THEN 124 ELSE GREATEST(review_count, 12) END,
          rating = CASE WHEN rating < 1 THEN 4.9 ELSE rating END,
          trust_metrics = {DEFAULT_TRUST_JSON}
        WHERE is_featured = true OR slug = 'anor-boutique'
        """
    )


def downgrade() -> None:
    op.drop_index("ix_shop_reviews_shop_status", table_name="shop_reviews")
    op.drop_index("ix_shop_reviews_shop_id", table_name="shop_reviews")
    op.drop_table("shop_reviews")
    op.drop_column("shops", "trust_metrics")
    op.drop_column("shops", "review_count")
