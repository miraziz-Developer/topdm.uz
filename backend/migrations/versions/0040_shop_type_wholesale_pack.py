"""Do'kon turi (chakana/optom) va pachka narxi maydonlari."""

from alembic import op
import sqlalchemy as sa

revision = "0040_shop_type_wholesale_pack"
down_revision = "0039_search_by_image_fn"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "shops",
        sa.Column("shop_type", sa.String(length=16), nullable=False, server_default="chakana"),
    )
    op.create_index("ix_shops_shop_type", "shops", ["shop_type"])

    op.add_column(
        "products",
        sa.Column("pricing_unit", sa.String(length=16), nullable=False, server_default="piece"),
    )
    op.add_column(
        "products",
        sa.Column("units_per_pack", sa.Integer(), nullable=True),
    )
    op.create_index("ix_products_pricing_unit", "products", ["pricing_unit"])


def downgrade() -> None:
    op.drop_index("ix_products_pricing_unit", table_name="products")
    op.drop_column("products", "units_per_pack")
    op.drop_column("products", "pricing_unit")
    op.drop_index("ix_shops_shop_type", table_name="shops")
    op.drop_column("shops", "shop_type")
