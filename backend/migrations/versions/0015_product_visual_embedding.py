"""Add visual_embedding for Taobao-style image similarity search."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision = "0015_product_visual_embedding"
down_revision = "0014_merchant_stories"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("visual_embedding", Vector(768), nullable=True))
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_products_visual_embedding_hnsw "
        "ON products USING hnsw (visual_embedding vector_cosine_ops) "
        "WHERE visual_embedding IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_products_visual_embedding_hnsw")
    op.drop_column("products", "visual_embedding")
