"""Unit tests for merchant product variant catalog helpers."""

from app.application.merchant.product_variants import build_attributes_from_catalog, parse_variant_catalog


def test_build_and_parse_roundtrip():
    catalog = {
        "all_sizes": ["S", "M", "L"],
        "colors": [
            {"name": "Qora", "sizes": ["S", "M"], "image_urls": ["/img/q1.jpg"]},
            {"name": "Oq", "sizes": ["L"], "image_urls": ["/img/w1.jpg"]},
        ],
        "sku_stock": {"qora|s": 3, "qora|m": 1, "oq|l": 5},
    }
    attrs, total = build_attributes_from_catalog(catalog)
    assert total == 9
    assert attrs["size_matrix"]["Qora"] == ["S", "M"]
    assert attrs["size_matrix"]["Oq"] == ["L"]
    assert len(attrs["skus"]) == 3

    parsed = parse_variant_catalog(attrs)
    assert parsed["all_sizes"]
    assert any(c["name"] == "Qora" for c in parsed["colors"])
    assert parsed["sku_stock"].get("qora|s") == 3


def test_parse_legacy_variants_only():
    attrs = {
        "variants": [
            {"color": "Qizil", "sizes": ["M"], "images": ["/a.jpg"]},
        ],
        "skus": [{"color": "Qizil", "size": "M", "stock": 2}],
    }
    parsed = parse_variant_catalog(attrs)
    assert parsed["colors"][0]["name"] == "Qizil"
    assert parsed["colors"][0]["sizes"] == ["M"]
    assert parsed["sku_stock"].get("qizil|m") == 2


def test_fallback_stock_without_skus():
    catalog = {"all_sizes": [], "colors": [], "sku_stock": {}, "fallback_stock": 12}
    attrs, total = build_attributes_from_catalog(catalog)
    assert total == 12
    assert attrs["skus"] == []
