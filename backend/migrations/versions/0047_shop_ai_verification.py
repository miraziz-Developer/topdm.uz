"""Shop AI verification status for automated moderator."""

from alembic import op
import sqlalchemy as sa

revision = "0047_shop_ai_verification"
down_revision = "0046_merchant_support_tickets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "shops",
        sa.Column("verification_status", sa.String(32), nullable=False, server_default="pending_ai"),
    )
    op.add_column("shops", sa.Column("verification_reason", sa.Text(), nullable=True))
    op.add_column("shops", sa.Column("ai_reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_shops_verification_status", "shops", ["verification_status"])
    op.execute(
        sa.text(
            "UPDATE shops SET verification_status = 'approved' WHERE is_verified = TRUE"
        )
    )


def downgrade() -> None:
    op.drop_index("ix_shops_verification_status", table_name="shops")
    op.drop_column("shops", "ai_reviewed_at")
    op.drop_column("shops", "verification_reason")
    op.drop_column("shops", "verification_status")
