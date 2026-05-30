"""indoor map engine tables

Revision ID: 0004_indoor_map_engine
Revises: 0003_phase4_shops_orders
Create Date: 2026-05-15
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004_indoor_map_engine"
down_revision = "0003_phase4_shops_orders"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "indoor_floor_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("market_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ipadroms.id"), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("view_box", sa.String(length=64), nullable=False, server_default="0 0 420 260"),
        sa.Column("geojson", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("navigation_graph", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("svg_overlay_url", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_indoor_floor_plans_market_level", "indoor_floor_plans", ["market_id", "level"], unique=True)

    op.create_table(
        "indoor_stalls",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("floor_plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("indoor_floor_plans.id"), nullable=False),
        sa.Column("stall_code", sa.String(length=32), nullable=False),
        sa.Column("block_code", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="vacant"),
        sa.Column("local_x", sa.Float(), nullable=False),
        sa.Column("local_y", sa.Float(), nullable=False),
        sa.Column("width", sa.Float(), nullable=False, server_default="28"),
        sa.Column("height", sa.Float(), nullable=False, server_default="24"),
        sa.Column("graph_node_id", sa.String(length=64), nullable=False),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id"), nullable=True),
        sa.Column("geometry", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_indoor_stalls_floor_plan_code", "indoor_stalls", ["floor_plan_id", "stall_code"], unique=True)
    op.create_index("ix_indoor_stalls_shop", "indoor_stalls", ["shop_id"], unique=False)

    op.add_column("shops", sa.Column("indoor_stall_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_shops_indoor_stall_id", "shops", "indoor_stalls", ["indoor_stall_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_shops_indoor_stall_id", "shops", type_="foreignkey")
    op.drop_column("shops", "indoor_stall_id")
    op.drop_index("ix_indoor_stalls_shop", table_name="indoor_stalls")
    op.drop_index("ix_indoor_stalls_floor_plan_code", table_name="indoor_stalls")
    op.drop_table("indoor_stalls")
    op.drop_index("ix_indoor_floor_plans_market_level", table_name="indoor_floor_plans")
    op.drop_table("indoor_floor_plans")
