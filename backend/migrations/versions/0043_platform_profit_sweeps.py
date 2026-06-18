"""Platform profit sweep ledger — komissiyani shaxsiy kartaga ko'chirish."""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0043_platform_profit_sweeps"
down_revision = "0042_drop_topdmbozor"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "platform_profit_sweeps",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("amount_uzs", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("destination", sa.String(length=64), nullable=False, server_default="personal_card"),
        sa.Column("reference", sa.String(length=128), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_platform_profit_sweeps_status", "platform_profit_sweeps", ["status"])
    op.create_index("ix_platform_profit_sweeps_created_at", "platform_profit_sweeps", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_platform_profit_sweeps_created_at", table_name="platform_profit_sweeps")
    op.drop_index("ix_platform_profit_sweeps_status", table_name="platform_profit_sweeps")
    op.drop_table("platform_profit_sweeps")
