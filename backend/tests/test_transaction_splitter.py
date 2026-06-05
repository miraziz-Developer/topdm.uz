"""Transaction splitter — deterministic math and integrity guards."""
from decimal import Decimal

import pytest

from app.application.finance.split_rules import (
    PaymentSplit,
    assert_split_integrity,
    compute_payment_split,
)


def test_split_basic_five_percent_commission():
    split = compute_payment_split(
        total_amount_received=Decimal("150000.00"),
        product_subtotal=Decimal("120000.00"),
        delivery_share=Decimal("25000.00"),
        commission_rate_pct=Decimal("5"),
    )
    assert split.platform_commission == Decimal("6000.00")
    assert split.merchant_share == Decimal("119000.00")
    assert_split_integrity(split)


def test_split_pickup_zero_delivery():
    split = compute_payment_split(
        total_amount_received=Decimal("89000.00"),
        product_subtotal=Decimal("89000.00"),
        delivery_share=Decimal("0.00"),
        commission_rate_pct=Decimal("5"),
    )
    assert split.delivery_share == Decimal("0.00")
    assert split.platform_commission == Decimal("4450.00")
    assert split.merchant_share == Decimal("84550.00")
    assert_split_integrity(split)


def test_split_penny_reconciliation():
    split = compute_payment_split(
        total_amount_received=Decimal("100001.00"),
        product_subtotal=Decimal("80000.00"),
        delivery_share=Decimal("15000.01"),
        commission_rate_pct=Decimal("5"),
    )
    assert_split_integrity(split)
    assert split.merchant_share >= Decimal("0.00")


def test_split_rejects_negative_merchant():
    with pytest.raises(ValueError, match="merchant_share negative"):
        compute_payment_split(
            total_amount_received=Decimal("5000.00"),
            product_subtotal=Decimal("4000.00"),
            delivery_share=Decimal("500.00"),
            commission_rate_pct=Decimal("150"),
        )


def test_split_rejects_product_plus_delivery_over_total():
    with pytest.raises(ValueError, match="exceeds total"):
        compute_payment_split(
            total_amount_received=Decimal("10000.00"),
            product_subtotal=Decimal("8000.00"),
            delivery_share=Decimal("5000.00"),
        )


def test_payment_split_as_dict_strings():
    split = compute_payment_split(
        total_amount_received=Decimal("200000"),
        product_subtotal=Decimal("170000"),
        delivery_share=Decimal("20000"),
        commission_rate_pct=Decimal("5"),
    )
    d = split.as_dict()
    assert all(isinstance(v, str) for v in d.values())
    assert Decimal(d["merchant_share"]) + Decimal(d["delivery_share"]) + Decimal(d["platform_commission"]) == Decimal(
        d["total_amount_received"]
    )
