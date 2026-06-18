"""Umumiy ombor zaxirasi — bot publish va yangilash."""

from app.application.merchant.product_variants import apply_warehouse_stock
from app.application.merchant.telegram_variant_draft import set_fallback_stock


def test_set_fallback_stock_clamps() -> None:
    draft = set_fallback_stock({"colors": [], "all_sizes": [], "fallback_stock": 0}, 25)
    assert draft["fallback_stock"] == 25
    draft = set_fallback_stock(draft, 200_000)
    assert draft["fallback_stock"] == 99_999


def test_apply_warehouse_stock_zeros_skus() -> None:
    attrs = {
        "skus": [
            {"color": "qora", "size": "42", "stock": 5},
            {"color": "oq", "size": "42", "stock": 5},
        ]
    }
    patched, total = apply_warehouse_stock(attrs, 12)
    assert total == 12
    assert all(int(row["stock"]) == 0 for row in patched["skus"])
