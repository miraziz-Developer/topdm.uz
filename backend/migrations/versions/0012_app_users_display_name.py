"""Add display_name to app_users

Revision ID: 0012_app_users_display_name
Revises: 0011_hybrid_auth_telegram
"""

from alembic import op
import sqlalchemy as sa

revision = "0012_app_users_display_name"
down_revision = "0011_hybrid_auth_telegram"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("app_users", sa.Column("display_name", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("app_users", "display_name")
