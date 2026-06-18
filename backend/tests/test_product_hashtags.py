from app.application.merchant.product_hashtags import (
    format_hashtags_display,
    parse_hashtags_from_text,
    suggest_hashtags_from_attrs,
)


def test_parse_hashtags_hash_prefix():
    assert parse_hashtags_from_text("#tufli #qora ayollar") == ["tufli", "qora", "ayollar"]


def test_parse_hashtags_comma_list():
    assert parse_hashtags_from_text("tufli, qora, baletka") == ["tufli", "qora", "baletka"]


def test_suggest_from_category_label():
    tags = suggest_hashtags_from_attrs(
        {"category_label": "Poyabzal › Ayollar poyabzali", "product_name": "Ayollar tuflisi"}
    )
    assert "poyabzal" in tags
    assert "ayollar" in tags


def test_format_display():
    assert format_hashtags_display(["tufli", "qora"]) == "#tufli #qora"
