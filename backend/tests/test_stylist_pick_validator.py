"""Unit tests for AI pick post-validation."""

from __future__ import annotations

from app.application.stylist.stylist_pick_validator import validate_ai_picks


def _product(pid: str, name: str, price: int = 200_000, **extra) -> dict:
    return {"id": pid, "name": name, "price": price, **extra}


def test_rejects_sweater_for_gym():
    catalog = [
        _product("a", "Erkak futbolka sport oq"),
        _product("b", "Erkak sviter jigarrang"),
        _product("c", "Erkak sport shim qora"),
    ]
    meta = {"style": "gym", "gender": "erkak", "budget": 500_000}
    out = validate_ai_picks(
        ["a", "b", "c"],
        catalog,
        meta=meta,
        user_message="erkak zal sport",
    )
    assert "b" not in out["product_ids"]
    assert "a" in out["product_ids"]


def test_rejects_gender_mismatch():
    catalog = [
        _product("m1", "Erkak krossovka sport"),
        _product("f1", "Ayol sviter qizil"),
    ]
    meta = {"style": "sport", "gender": "erkak"}
    out = validate_ai_picks(["m1", "f1"], catalog, meta=meta, user_message="erkak sport")
    assert out["product_ids"] == ["m1"]


def test_budget_filter():
    catalog = [_product("x", "Erkak futbolka", price=900_000)]
    meta = {"style": "sport", "gender": "erkak", "budget": 500_000}
    out = validate_ai_picks(["x"], catalog, meta=meta, user_message="500 ming")
    assert out["product_ids"] == []
