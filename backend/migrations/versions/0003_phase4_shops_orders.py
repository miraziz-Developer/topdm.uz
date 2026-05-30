"""phase 4 shop slugs and customer orders

Revision ID: 0003_phase4_shops_orders
Revises: 0002_marketplace_core_tables
Create Date: 2026-05-15
"""

import re
import unicodedata

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003_phase4_shops_orders"
down_revision = "0002_marketplace_core_tables"
branch_labels = None
depends_on = None


def _slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    return slug or "shop"


def upgrade() -> None:
    op.add_column("shops", sa.Column("slug", sa.String(length=120), nullable=True))
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, name FROM shops")).fetchall()
    used: set[str] = set()
    for row in rows:
        base = _slugify(row.name)
        candidate = base
        suffix = 2
        while candidate in used:
            candidate = f"{base}-{suffix}"
            suffix += 1
        used.add(candidate)
        bind.execute(
            sa.text("UPDATE shops SET slug = :slug WHERE id = :id"),
            {"slug": candidate, "id": row.id},
        )
    op.alter_column("shops", "slug", nullable=False)
    op.create_index("ix_shops_slug", "shops", ["slug"], unique=True)

    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_phone", sa.String(length=20), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id"), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("total_price", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("ref_token", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_orders_customer_phone", "orders", ["customer_phone"], unique=False)
    op.create_index("ix_orders_shop_status", "orders", ["shop_id", "status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_orders_shop_status", table_name="orders")
    op.drop_index("ix_orders_customer_phone", table_name="orders")
    op.drop_table("orders")
    op.drop_index("ix_shops_slug", table_name="shops")
    op.drop_column("shops", "slug")
