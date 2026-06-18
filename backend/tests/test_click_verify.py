"""Click to'lov imzosi tekshiruvi."""
from __future__ import annotations

import hashlib
import time

from app.application.payments.click_verify import build_click_sign_string, verify_click_callback
from app.core.config import Settings


def _sandbox_settings() -> Settings:
    return Settings(
        payment_sandbox_mode=True,
        payment_sandbox_click_service_id="123",
        payment_sandbox_click_secret_key="test-secret",
        app_debug=False,
        production=False,
    )


def test_click_sign_valid():
    settings = _sandbox_settings()
    secret = settings.payment_sandbox_click_secret_key
    service_id = settings.payment_sandbox_click_service_id
    sign_time = str(int(time.time()))
    click_trans_id = "12345"
    merchant_trans_id = "order-uuid"
    amount = "100000"
    sign_string = build_click_sign_string(
        click_trans_id=click_trans_id,
        service_id=service_id,
        secret_key=secret,
        merchant_trans_id=merchant_trans_id,
        amount=amount,
        action="0",
        sign_time=sign_time,
    )
    sign = hashlib.md5(sign_string.encode("utf-8")).hexdigest()
    payload = {
        "click_trans_id": click_trans_id,
        "service_id": service_id,
        "merchant_trans_id": merchant_trans_id,
        "amount": amount,
        "action": "0",
        "sign_time": sign_time,
        "sign_string": sign,
    }
    assert verify_click_callback(payload, settings=settings) is True


def test_click_sign_invalid():
    settings = _sandbox_settings()
    sign_time = str(int(time.time()))
    payload = {
        "click_trans_id": "1",
        "service_id": "123",
        "merchant_trans_id": "m",
        "amount": "1",
        "action": "0",
        "sign_time": sign_time,
        "sign_string": "deadbeef",
    }
    assert verify_click_callback(payload, settings=settings) is False
