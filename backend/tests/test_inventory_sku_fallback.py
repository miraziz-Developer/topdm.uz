"""SKU stock grid fallback when per-variant stock is unset."""

from decimal import Decimal

from app.services.inventory import (
    _all_skus_unstocked,
    _sku_stock_from_attributes,
    _use_aggregate_stock_fallback,
)


class _ProductStub:
    def __init__(self, *, stock_count: int, attributes: dict) -> None:
        self.stock_count = stock_count
        self.attributes = attributes


def test_sku_stock_missing_variant_returns_none() -> None:
    attrs = {"skus": [{"color": "qora", "size": "M", "stock": 2}]}
    assert _sku_stock_from_attributes(attrs, color="oq", size="L") is None


def test_all_skus_unstocked_detected() -> None:
    attrs = {
        "skus": [
            {"color": "pushti", "size": "42", "stock": 0},
            {"color": "oq", "size": "42", "stock": 0},
        ]
    }
    assert _all_skus_unstocked(attrs) is True


def test_aggregate_fallback_when_sku_grid_empty_stock() -> None:
    product = _ProductStub(
        stock_count=5,
        attributes={"skus": [{"color": "pushti", "size": "42", "stock": 0}]},
    )
    assert _use_aggregate_stock_fallback(product, sku_stock=0, quantity=1) is True
