"""shop precision location fields

Revision ID: 0005_shop_precision_location
Revises: 0004_indoor_map_engine
Create Date: 2026-05-15
"""

import sqlalchemy as sa
from alembic import op

revision = "0005_shop_precision_location"
down_revision = "0004_indoor_map_engine"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("shops", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("shops", sa.Column("longitude", sa.Float(), nullable=True))
    op.add_column("shops", sa.Column("location_accuracy", sa.Float(), nullable=True))
    op.add_column("shops", sa.Column("location_comment", sa.Text(), nullable=True))
    op.add_column("shops", sa.Column("indoor_pin_x", sa.Float(), nullable=True))
    op.add_column("shops", sa.Column("indoor_pin_y", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("shops", "indoor_pin_y")
    op.drop_column("shops", "indoor_pin_x")
    op.drop_column("shops", "location_comment")
    op.drop_column("shops", "location_accuracy")
    op.drop_column("shops", "longitude")
    op.drop_column("shops", "latitude")
