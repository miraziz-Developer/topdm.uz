"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-07
"""

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "global_shops",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("block", sa.String(length=64), nullable=False),
        sa.Column("row", sa.String(length=64), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("telegram_username", sa.String(length=64), nullable=True),
        sa.Column("address_note", sa.String(length=255), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.create_index("ix_global_shops_name", "global_shops", ["name"])

    op.create_table(
        "unified_products",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="UZS"),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("embedding", Vector(dim=1536), nullable=False),
        sa.Column("ai_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("shop_id", sa.Integer(), sa.ForeignKey("global_shops.id"), nullable=False),
    )
    op.create_index("ix_unified_products_shop_id", "unified_products", ["shop_id"])
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_unified_products_embedding "
        "ON unified_products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )

    op.create_table(
        "leads",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("unified_products.id"), nullable=False),
        sa.Column("shop_id", sa.Integer(), sa.ForeignKey("global_shops.id"), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.create_index("ix_leads_user_id", "leads", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_leads_user_id", table_name="leads")
    op.drop_table("leads")
    op.execute("DROP INDEX IF EXISTS idx_unified_products_embedding")
    op.drop_index("ix_unified_products_shop_id", table_name="unified_products")
    op.drop_table("unified_products")
    op.drop_index("ix_global_shops_name", table_name="global_shops")
    op.drop_table("global_shops")
