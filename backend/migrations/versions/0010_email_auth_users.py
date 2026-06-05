"""Email auth + app_users + shop owner_email

Revision ID: 0010_email_auth_users
Revises: 0009_chat_and_publish_pipeline
Create Date: 2026-05-15
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0010_email_auth_users"
down_revision = "0009_chat_and_publish_pipeline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_app_users_email", "app_users", ["email"], unique=True)
    op.create_index("ix_app_users_phone", "app_users", ["phone"], unique=False)

    op.add_column("shops", sa.Column("owner_email", sa.String(length=255), nullable=True))
    op.create_index("ix_shops_owner_email", "shops", ["owner_email"], unique=True)
    op.execute(
        "UPDATE shops SET owner_email = 'samandar@bozorliii.uz' "
        "WHERE owner_phone = '+998901234567' AND owner_email IS NULL"
    )
    op.execute(
        "UPDATE shops SET owner_email = 'techworld@bozorliii.uz' "
        "WHERE owner_phone = '+998901234568' AND owner_email IS NULL"
    )


def downgrade() -> None:
    op.drop_index("ix_shops_owner_email", table_name="shops")
    op.drop_column("shops", "owner_email")
    op.drop_index("ix_app_users_phone", table_name="app_users")
    op.drop_index("ix_app_users_email", table_name="app_users")
    op.drop_table("app_users")
