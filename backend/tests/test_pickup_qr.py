from uuid import uuid4

import pytest

from app.application.merchant.pickup_qr import (
    issue_pickup_qr_token,
    normalize_scanned_payload,
    verify_pickup_qr_token,
)


def test_issue_and_verify_roundtrip():
    order_id = uuid4()
    shop_id = uuid4()
    token, exp = issue_pickup_qr_token(order_id, shop_id, ttl_hours=24)
    assert token.startswith("BLZ1.")
    got_order, got_shop = verify_pickup_qr_token(token)
    assert got_order == order_id
    assert got_shop == shop_id
    assert exp > 0


def test_normalize_from_url():
    order_id = uuid4()
    shop_id = uuid4()
    token, _ = issue_pickup_qr_token(order_id, shop_id)
    wrapped = f"https://bozorliii.online/pickup?token={token}"
    assert normalize_scanned_payload(wrapped) == token


def test_invalid_token_raises():
    with pytest.raises(ValueError, match="invalid_qr_token"):
        verify_pickup_qr_token("BLZ1.not-a-valid-token")
