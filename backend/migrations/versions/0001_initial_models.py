"""initial models with pgvector hnsw

Revision ID: 0001_initial_models
Revises:
Create Date: 2026-05-07
"""

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision = "0001_initial_models"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "global_shops",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("block", sa.String(length=50), nullable=False),
        sa.Column("row", sa.String(length=50), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.create_index("ix_global_shops_name", "global_shops", ["name"], unique=False)

    op.create_table(
        "unified_products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=False, server_default="UZS"),
        sa.Column("embedding", Vector(1536), nullable=False),
        sa.Column("ai_generated_tags", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("vision_attributes", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.create_index("ix_unified_products_name", "unified_products", ["name"], unique=False)
    op.create_index("ix_unified_products_shop_id", "unified_products", ["shop_id"], unique=False)
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_unified_products_embedding_hnsw "
        "ON unified_products USING hnsw (embedding vector_cosine_ops)"
    )

    op.create_table(
        "product_lead_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=False, server_default="telegram_webapp"),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.create_index("ix_product_lead_events_product_id", "product_lead_events", ["product_id"], unique=False)
    op.create_index("ix_product_lead_events_user_id", "product_lead_events", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_product_lead_events_user_id", table_name="product_lead_events")
    op.drop_index("ix_product_lead_events_product_id", table_name="product_lead_events")
    op.drop_table("product_lead_events")
    op.execute("DROP INDEX IF EXISTS idx_unified_products_embedding_hnsw")
    op.drop_index("ix_unified_products_shop_id", table_name="unified_products")
    op.drop_index("ix_unified_products_name", table_name="unified_products")
    op.drop_table("unified_products")
    op.drop_index("ix_global_shops_name", table_name="global_shops")
    op.drop_table("global_shops")
