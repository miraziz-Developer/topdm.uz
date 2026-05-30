"""Featured shops + moderation metadata on pending products."""

from alembic import op
import sqlalchemy as sa

revision = "0008_featured_shops_moderation"
down_revision = "0007_route_stats"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "shops",
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "shops",
        sa.Column("featured_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "merchant_pending_products",
        sa.Column("moderation_reason", sa.Text(), nullable=True),
    )
    op.create_index("ix_shops_is_featured", "shops", ["is_featured"])
    op.add_column(
        "tracking_events",
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("tracking_events", "created_at")
    op.drop_index("ix_shops_is_featured", table_name="shops")
    op.drop_column("merchant_pending_products", "moderation_reason")
    op.drop_column("shops", "featured_until")
    op.drop_column("shops", "is_featured")
