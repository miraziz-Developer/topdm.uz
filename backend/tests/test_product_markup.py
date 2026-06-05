"""Mahsulot +15% ustama hisobi."""
from decimal import Decimal

import pytest

from app.application.finance.split_rules import assert_split_integrity, compute_payment_split_with_markup
from app.application.pricing.product_markup import (
    customer_sale_price_uzs,
    order_line_totals,
    platform_markup_uzs,
)


def test_sale_price_15_percent_ceiling():
    assert customer_sale_price_uzs(100_000) == 115_000
    assert platform_markup_uzs(100_000) == 15_000


def test_order_line_totals():
    merchant, customer, markup = order_line_totals(200_000, 2)
    assert merchant == 400_000
    assert customer == 460_000
    assert markup == 60_000


def test_payment_split_matches_markup():
    merchant, customer, _ = order_line_totals(100_000, 1)
    split = compute_payment_split_with_markup(
        total_amount_received=Decimal(customer),
        merchant_goods_subtotal=Decimal(merchant),
        delivery_share=Decimal("0"),
    )
    assert split.platform_commission == Decimal("15000.00")
    assert split.merchant_share == Decimal("100000.00")
    assert_split_integrity(split)
