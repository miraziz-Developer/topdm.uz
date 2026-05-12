"""marketplace core tables for mvp

Revision ID: 0002_marketplace_core_tables
Revises: 0001_initial_models
Create Date: 2026-05-09
"""

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision = "0002_marketplace_core_tables"
down_revision = "0001_initial_models"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ipadroms",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("city", sa.String(length=100), nullable=False),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )

    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("name_ru", sa.String(length=100), nullable=True),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("categories.id"), nullable=True),
        sa.Column("icon", sa.String(length=50), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )

    op.create_table(
        "shops",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_phone", sa.String(length=20), nullable=False, unique=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("ipadrom_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ipadroms.id"), nullable=True),
        sa.Column("floor", sa.String(length=50), nullable=True),
        sa.Column("section", sa.String(length=100), nullable=True),
        sa.Column("telegram_chat_id", sa.BigInteger(), nullable=True),
        sa.Column("logo_url", sa.Text(), nullable=True),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("rating", sa.Float(), nullable=False, server_default=sa.text("0")),
    )

    op.create_table(
        "products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("categories.id"), nullable=True),
        sa.Column("name", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Integer(), nullable=False),
        sa.Column("price_negotiable", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("images", postgresql.ARRAY(sa.Text()), nullable=False, server_default=sa.text("'{}'::text[]")),
        sa.Column("attributes", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("embedding", Vector(1536), nullable=False),
        sa.Column("is_available", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("view_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("lead_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("visit_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )

    op.create_table(
        "leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id"), nullable=False),
        sa.Column("customer_phone", sa.String(length=20), nullable=False),
        sa.Column("customer_name", sa.String(length=100), nullable=True),
        sa.Column("ref_token", sa.String(length=50), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("note", sa.Text(), nullable=True),
    )

    op.create_table(
        "tracking_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_type", sa.String(length=30), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=True),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id"), nullable=True),
        sa.Column("ref_token", sa.String(length=50), nullable=True),
        sa.Column("session_id", sa.String(length=100), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )

    op.create_index("ix_products_shop_available", "products", ["shop_id", "is_available"], unique=False)
    op.create_index("ix_products_category_price", "products", ["category_id", "price"], unique=False)
    op.execute("CREATE INDEX IF NOT EXISTS idx_products_embedding_hnsw ON products USING hnsw (embedding vector_cosine_ops)")
    op.create_index("ix_leads_shop_status_created", "leads", ["shop_id", "status"], unique=False)
    op.create_index("ix_tracking_events_shop_type", "tracking_events", ["shop_id", "event_type"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_tracking_events_shop_type", table_name="tracking_events")
    op.drop_index("ix_leads_shop_status_created", table_name="leads")
    op.execute("DROP INDEX IF EXISTS idx_products_embedding_hnsw")
    op.drop_index("ix_products_category_price", table_name="products")
    op.drop_index("ix_products_shop_available", table_name="products")
    op.drop_table("tracking_events")
    op.drop_table("leads")
    op.drop_table("products")
    op.drop_table("shops")
    op.drop_table("categories")
    op.drop_table("ipadroms")
