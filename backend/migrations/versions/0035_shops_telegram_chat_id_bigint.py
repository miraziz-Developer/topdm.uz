"""shops.telegram_chat_id → BIGINT (Telegram ID int32 dan katta bo'lishi mumkin)

Revision ID: 0035_shop_tg_chat_bigint
Revises: 0034_enterprise_engine
Create Date: 2026-06-05

"""

from alembic import op
import sqlalchemy as sa

revision = "0035_shop_tg_chat_bigint"
down_revision = "0034_enterprise_engine"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "shops",
        "telegram_chat_id",
        existing_type=sa.Integer(),
        type_=sa.BigInteger(),
        existing_nullable=True,
        postgresql_using="telegram_chat_id::bigint",
    )


def downgrade() -> None:
    op.alter_column(
        "shops",
        "telegram_chat_id",
        existing_type=sa.BigInteger(),
        type_=sa.Integer(),
        existing_nullable=True,
    )
