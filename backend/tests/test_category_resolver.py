from app.application.merchant.category_resolver import infer_audience, infer_hint_from_attrs, resolve_tree_names


def test_infer_audience_erkak_shim():
    assert infer_audience("Erkaklar shim", "shim") == "erkak"


def test_resolve_tree_names_erkak_shim():
    route = resolve_tree_names({"product_name": "Erkaklar shim", "category_hint": "shim"})
    assert route == ("Erkaklar kiyimi", "Shim va jinsi")


def test_resolve_tree_names_ayol_shoes():
    route = resolve_tree_names({"product_name": "Ayollar tuflisi", "category_hint": "poyabzal"})
    assert route == ("Poyabzal", "Ayollar poyabzali")


def test_infer_hint_from_product_name_only():
    assert infer_hint_from_attrs({"product_name": "Shim", "category_hint": "boshqa"}) == "shim"


def test_resolve_from_name_without_hint():
    route = resolve_tree_names({"product_name": "Erkaklar jinsi shim", "category_hint": "boshqa"})
    assert route == ("Erkaklar kiyimi", "Shim va jinsi")
