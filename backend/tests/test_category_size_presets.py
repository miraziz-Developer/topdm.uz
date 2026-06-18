from app.application.merchant.category_size_presets import (
    size_group_for_context,
    size_presets_for_context,
)


def test_shoes_from_category_label():
    group = size_group_for_context("boshqa", "Poyabzal › Sandallar va shippak")
    assert group == "shoes"
    assert size_presets_for_context("Poyabzal › Sandallar va shippak")[0] == "36"


def test_clothing_from_womens_category():
    group = size_group_for_context("Ayollar kiyimi › Futbolka va mayka")
    assert group == "clothing"
    assert "S" in size_presets_for_context("Ayollar kiyimi › Futbolka va mayka")


def test_shoes_from_product_name_when_category_other():
    group = size_group_for_context("boshqa", "", "Ayollar shippagi qora")
    assert group == "shoes"


def test_pants_sizes():
    presets = size_presets_for_context("Erkaklar kiyimi › Shim va jinsi")
    assert presets[0] == "28"


def test_kids_sizes():
    group = size_group_for_context("Bolalar kiyimi › Kundalik kiyim")
    assert group == "kids"
