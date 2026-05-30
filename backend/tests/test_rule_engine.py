"""If-then personalization rule engine tests."""

from app.application.personalization.rule_engine import UserSignals, evaluate_experience


def test_active_pickup_rule():
    signals = UserSignals(active_orders_count=1, active_order_map_href="/map?x=1")
    out = evaluate_experience(signals)
    assert out["rule_id"] == "active_pickup"
    assert out["banner"]["title"]
    assert any(c["href"] == "/orders" for c in out["ctas"])


def test_returning_not_active():
    signals = UserSignals(completed_orders_count=2, active_orders_count=0)
    out = evaluate_experience(signals)
    assert out["rule_id"] == "returning_shopper"


def test_resume_requires_visit_min():
    signals = UserSignals(last_shop_slug="test-shop", last_shop_name="Test", visit_count=1)
    out = evaluate_experience(signals)
    assert out["rule_id"] != "resume_shop"


def test_resume_shop():
    signals = UserSignals(
        last_shop_slug="test-shop",
        last_shop_name="Test Shop",
        visit_count=3,
        active_orders_count=0,
    )
    out = evaluate_experience(signals)
    assert out["rule_id"] == "resume_shop"
    assert "Test Shop" in out["banner"]["title"]


def test_wholesale_mode():
    signals = UserSignals(sale_mode="Optom", active_orders_count=0, completed_orders_count=0)
    out = evaluate_experience(signals)
    assert out["rule_id"] == "wholesale_buyer"
    assert out["catalog_hints"].get("sale_mode") == "Optom"


def test_new_guest():
    signals = UserSignals(is_logged_in=False, visit_count=2)
    out = evaluate_experience(signals)
    assert out["rule_id"] == "new_guest"
