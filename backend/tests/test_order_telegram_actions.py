import uuid

from app.application.merchant.merchant_order_notify import (
    allowed_order_bot_actions,
    order_action_markup,
    order_action_not_allowed_message,
)


def test_pickup_reserved_shows_confirm_only():
    assert allowed_order_bot_actions(status="reserved", fulfillment_type="pickup") == ["c", "x"]
    keys = order_action_markup(uuid.uuid4(), uuid.uuid4(), status="reserved")
    labels = [btn["text"] for row in keys["inline_keyboard"] for btn in row]
    assert "✅ Tasdiq" in labels
    assert "📦 Tayyor" not in labels
    assert "✔️ Olib ketdi" not in labels


def test_pickup_confirmed_shows_ready_only():
    assert allowed_order_bot_actions(status="confirmed", fulfillment_type="pickup") == ["r", "x"]
    keys = order_action_markup(uuid.uuid4(), uuid.uuid4(), status="confirmed")
    labels = [btn["text"] for row in keys["inline_keyboard"] for btn in row]
    assert "📦 Tayyor" in labels
    assert "✔️ Olib ketdi" not in labels


def test_pickup_ready_shows_reject_and_qr_only():
    assert allowed_order_bot_actions(status="ready", fulfillment_type="pickup") == ["x"]
    keys = order_action_markup(uuid.uuid4(), uuid.uuid4(), status="ready")
    labels = [btn["text"] for row in keys["inline_keyboard"] for btn in row]
    assert "✔️ Olib ketdi" not in labels
    assert "📷 QR Skaner" in labels
    assert "❌ Rad" in labels
    assert "✅ Tasdiq" not in labels


def test_delivery_ready_no_pickup_complete():
    assert allowed_order_bot_actions(status="ready", fulfillment_type="delivery") == ["x"]
    keys = order_action_markup(uuid.uuid4(), uuid.uuid4(), status="ready", fulfillment_type="delivery")
    labels = [btn["text"] for row in keys["inline_keyboard"] for btn in row]
    assert "✔️ Olib ketdi" not in labels


def test_completed_has_crm_only():
    assert allowed_order_bot_actions(status="completed", fulfillment_type="pickup") == []
    keys = order_action_markup(uuid.uuid4(), uuid.uuid4(), status="completed")
    labels = [btn["text"] for row in keys["inline_keyboard"] for btn in row]
    assert labels == ["📱 CRM ochish"]


def test_not_allowed_messages():
    assert "QR skaner" in order_action_not_allowed_message("d", "ready").lower()
    assert "Click" in order_action_not_allowed_message("c", "reserved", click_payment_pending=True)


def test_click_pending_hides_confirm():
    assert allowed_order_bot_actions(status="reserved", click_payment_pending=True) == ["x"]
    keys = order_action_markup(uuid.uuid4(), uuid.uuid4(), status="reserved", click_payment_pending=True)
    labels = [btn["text"] for row in keys["inline_keyboard"] for btn in row]
    assert "✅ Tasdiq" not in labels
    assert "❌ Rad" in labels
