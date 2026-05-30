"""route_stats heatmap + merchant alert audit log

Revision ID: 0007_route_stats
Revises: 0006_merchant_pending_products
Create Date: 2026-05-15
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0007_route_stats"
down_revision = "0006_merchant_pending_products"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "route_stats",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("market_slug", sa.String(length=64), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("start_node_id", sa.String(length=64), nullable=False),
        sa.Column("goal_node_id", sa.String(length=64), nullable=False),
        sa.Column("node_ids", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="api"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_route_stats_market_level", "route_stats", ["market_slug", "level"])
    op.create_index("ix_route_stats_goal_node", "route_stats", ["goal_node_id"])
    op.create_index("ix_route_stats_created_at", "route_stats", ["created_at"])

    op.create_table(
        "merchant_alert_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("shop_id", UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("alert_type", sa.String(length=64), nullable=False),
        sa.Column(
            "sent_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_merchant_alert_logs_shop_type", "merchant_alert_logs", ["shop_id", "alert_type"])


def downgrade() -> None:
    op.drop_index("ix_merchant_alert_logs_shop_type", table_name="merchant_alert_logs")
    op.drop_table("merchant_alert_logs")
    op.drop_index("ix_route_stats_created_at", table_name="route_stats")
    op.drop_index("ix_route_stats_goal_node", table_name="route_stats")
    op.drop_index("ix_route_stats_market_level", table_name="route_stats")
    op.drop_table("route_stats")
