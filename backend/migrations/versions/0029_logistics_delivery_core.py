"""Logistics: product dimensions, order delivery fields, delivery claims, merchant payouts."""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0029_logistics_delivery_core"
down_revision = "0028_order_checkout_payments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("weight_kg", sa.Numeric(8, 3), nullable=True))
    op.add_column("products", sa.Column("length_cm", sa.Integer(), nullable=True))
    op.add_column("products", sa.Column("width_cm", sa.Integer(), nullable=True))
    op.add_column("products", sa.Column("height_cm", sa.Integer(), nullable=True))

    op.add_column("orders", sa.Column("delivery_address", sa.Text(), nullable=True))
    op.add_column("orders", sa.Column("delivery_city", sa.String(length=120), nullable=True))
    op.add_column("orders", sa.Column("delivery_lat", sa.Float(), nullable=True))
    op.add_column("orders", sa.Column("delivery_lng", sa.Float(), nullable=True))
    op.add_column("orders", sa.Column("carrier_class", sa.String(length=16), nullable=True))
    op.add_column("orders", sa.Column("delivery_cost_uzs", sa.Integer(), nullable=True))
    op.add_column("orders", sa.Column("delivery_eta_minutes", sa.Integer(), nullable=True))

    op.create_table(
        "delivery_claims",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("yandex_claim_id", sa.String(length=128), nullable=True, index=True),
        sa.Column("carrier_class", sa.String(length=16), nullable=False, server_default="express"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft", index=True),
        sa.Column("delivery_cost", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("eta_minutes", sa.Integer(), nullable=True),
        sa.Column("offer_payload", sa.Text(), nullable=True),
        sa.Column("yandex_revision", sa.String(length=64), nullable=True),
        sa.Column("meta", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("order_id", name="uq_delivery_claims_order_id"),
    )
    op.create_index("ix_delivery_claims_shop_id", "delivery_claims", ["shop_id"])

    op.create_table(
        "merchant_payout_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount_uzs", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending", index=True),
        sa.Column("destination", sa.String(length=64), nullable=False, server_default="bank_card"),
        sa.Column("reference", sa.String(length=128), nullable=True),
        sa.Column("meta", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_merchant_payout_requests_shop_id", "merchant_payout_requests", ["shop_id"])


def downgrade() -> None:
    op.drop_index("ix_merchant_payout_requests_shop_id", table_name="merchant_payout_requests")
    op.drop_table("merchant_payout_requests")
    op.drop_index("ix_delivery_claims_shop_id", table_name="delivery_claims")
    op.drop_table("delivery_claims")
    op.drop_column("orders", "delivery_eta_minutes")
    op.drop_column("orders", "delivery_cost_uzs")
    op.drop_column("orders", "carrier_class")
    op.drop_column("orders", "delivery_lng")
    op.drop_column("orders", "delivery_lat")
    op.drop_column("orders", "delivery_city")
    op.drop_column("orders", "delivery_address")
    op.drop_column("products", "height_cm")
    op.drop_column("products", "width_cm")
    op.drop_column("products", "length_cm")
    op.drop_column("products", "weight_kg")
