"""Hybrid auth: telegram_id on app_users, nullable email

Revision ID: 0011_hybrid_auth_telegram
Revises: 0010_email_auth_users
"""

from alembic import op
import sqlalchemy as sa

revision = "0011_hybrid_auth_telegram"
down_revision = "0010_email_auth_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("app_users", sa.Column("telegram_id", sa.BigInteger(), nullable=True))
    op.create_index("ix_app_users_telegram_id", "app_users", ["telegram_id"], unique=True)
    op.alter_column("app_users", "email", existing_type=sa.String(length=255), nullable=True)


def downgrade() -> None:
    op.alter_column("app_users", "email", existing_type=sa.String(length=255), nullable=False)
    op.drop_index("ix_app_users_telegram_id", table_name="app_users")
    op.drop_column("app_users", "telegram_id")
