"""Click Business (self-employed) Merchant API + hosted pay URL va Q-PAY mock testlari."""
from __future__ import annotations

import asyncio
from urllib.parse import parse_qs, urlparse

from app.application.payments.click_merchant_api import (
    ClickMerchantClient,
    build_click_pay_url,
)
from app.core.config import Settings
from app.infrastructure.payments.qpay_client import QpayClient


def _settings() -> Settings:
    return Settings(
        payment_sandbox_mode=False,
        click_service_id="SVC123",
        click_secret_key="secret-xyz",
        click_merchant_id="MID777",
        click_merchant_user_id="",  # mock invoice
        production=False,
        app_debug=False,
    )


def test_click_pay_url_contains_required_params():
    settings = _settings()
    url = build_click_pay_url(
        amount_uzs=150_000,
        transaction_param="checkout-1",
        return_url="https://bozorliii.uz/orders",
        settings=settings,
    )
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    assert parsed.netloc == "my.click.uz"
    assert qs["service_id"] == ["SVC123"]
    assert qs["merchant_id"] == ["MID777"]
    assert qs["amount"] == ["150000.00"]
    assert qs["transaction_param"] == ["checkout-1"]
    assert qs["return_url"] == ["https://bozorliii.uz/orders"]


def test_click_pay_url_sandbox_uses_sandbox_service():
    settings = Settings(
        payment_sandbox_mode=True,
        payment_sandbox_click_service_id="SBX1",
        click_merchant_id="MID9",
        production=False,
        app_debug=False,
    )
    url = build_click_pay_url(amount_uzs=1000, transaction_param="x", settings=settings)
    qs = parse_qs(urlparse(url).query)
    assert qs["service_id"] == ["SBX1"]


def test_click_merchant_invoice_mock():
    settings = _settings()  # merchant_user_id bo'sh -> mock
    client = ClickMerchantClient(settings)
    result = asyncio.run(
        client.create_invoice(amount_uzs=150_000, phone_number="998901234567", merchant_trans_id="chk-1")
    )
    assert result["error_code"] == 0
    assert result["mock"] is True
    assert "invoice_id" in result


def test_click_auth_header_format():
    settings = _settings()
    client = ClickMerchantClient(settings)
    header = client._auth_header()
    parts = header.split(":")
    assert len(parts) == 3  # user_id:digest:timestamp
    assert len(parts[1]) == 40  # sha1 hex
    assert parts[2].isdigit()


def test_qpay_mock_full_flow():
    settings = Settings(qpay_base_url="", production=False, app_debug=False)
    client = QpayClient(settings)
    created = asyncio.run(client.create_payment(account="chk-1", amount_uzs=150_000))
    assert created["mock"] is True
    tx = created["transaction_id"]
    paid_step = asyncio.run(client.pay_with_card(transaction_id=tx, pan="8600000000000000", expiry="2812"))
    assert paid_step["otp_sent"] is True
    applied = asyncio.run(client.apply_otp(transaction_id=tx, otp="123456"))
    assert applied["status"] == "paid"
