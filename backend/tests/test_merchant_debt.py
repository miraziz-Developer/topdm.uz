"""Merchant debt accrual for offline pickup."""
from __future__ import annotations

from uuid import uuid4

import pytest

from app.application.billing.merchant_debt_service import (
    commission_uzs_for_line,
    is_offline_pickup_payment,
    parse_payment_method_from_note,
    resolve_order_payment_method,
)
from app.application.pricing.product_markup import platform_markup_uzs
from app.core.config import Settings
from app.infrastructure.db.models import OrderModel


def test_parse_payment_from_note():
    note = "Olib ketish: 2026-06-02 | To'lov: Naqd pul"
    assert parse_payment_method_from_note(note) == "cash"


def test_offline_payment_detection():
    assert is_offline_pickup_payment("cash")
    assert is_offline_pickup_payment("terminal")
    assert not is_offline_pickup_payment("click")


def test_commission_matches_markup():
    base = 100_000
    qty = 2
    settings = Settings(platform_product_markup_pct=15.0)
    assert commission_uzs_for_line(merchant_base_unit_uzs=base, quantity=qty, settings=settings) == (
        platform_markup_uzs(base, settings) * qty
    )


def test_resolve_payment_method_column_first():
    order = OrderModel(
        customer_phone="+998901234567",
        product_id=uuid4(),
        shop_id=uuid4(),
        quantity=1,
        total_price=115_000,
        payment_method="terminal",
        note="To'lov: Naqd pul",
    )
    assert resolve_order_payment_method(order) == "terminal"
