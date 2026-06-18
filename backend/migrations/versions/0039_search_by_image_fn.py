"""pgvector search_by_image RPC — CLIP 768-d cosine similarity."""

from alembic import op

revision = "0039_search_by_image_fn"
down_revision = "0038_publish_pending_reviews"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION search_by_image(
            query_embedding vector(768),
            match_count int DEFAULT 20
        )
        RETURNS TABLE (
            id uuid,
            name text,
            price int,
            images text[],
            similarity float
        )
        LANGUAGE sql STABLE
        AS $$
            SELECT
                p.id,
                p.name,
                p.price,
                p.images,
                (1 - (p.visual_embedding <=> query_embedding))::float AS similarity
            FROM products p
            WHERE p.is_available = true
              AND p.visual_embedding IS NOT NULL
            ORDER BY p.visual_embedding <=> query_embedding
            LIMIT match_count;
        $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS search_by_image(vector, int);")
