"""Live chat threads/messages and publish pipeline columns on pending products."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0009_chat_and_publish_pipeline"
down_revision = "0008_featured_shops_moderation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "chat_threads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("customer_key", sa.String(length=128), nullable=False),
        sa.Column("customer_display_name", sa.String(length=120), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_chat_threads_shop_customer", "chat_threads", ["shop_id", "customer_key"], unique=True)
    op.create_index("ix_chat_threads_shop_id", "chat_threads", ["shop_id"])

    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "thread_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chat_threads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sender_role", sa.String(length=20), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_chat_messages_thread_created", "chat_messages", ["thread_id", "created_at"])

    op.add_column(
        "merchant_pending_products",
        sa.Column("published_product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=True),
    )
    op.add_column(
        "merchant_pending_products",
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("merchant_pending_products", "updated_at")
    op.drop_column("merchant_pending_products", "published_product_id")
    op.drop_index("ix_chat_messages_thread_created", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_index("ix_chat_threads_shop_id", table_name="chat_threads")
    op.drop_index("ix_chat_threads_shop_customer", table_name="chat_threads")
    op.drop_table("chat_threads")
