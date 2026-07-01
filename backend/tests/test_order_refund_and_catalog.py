"""Click refund mock, outbound notify shablonlari, kategoriya filtri."""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.application.payments.click_merchant_api import ClickMerchantClient
from app.application.payments.order_refund_service import OrderRefundService
from app.core.config import Settings
from app.infrastructure.messaging.resend_email import build_order_status_html


def _sandbox_settings() -> Settings:
    return Settings(
        payment_sandbox_mode=True,
        payment_sandbox_click_service_id="SBX1",
        payment_sandbox_click_secret_key="sandbox-secret",
        click_merchant_user_id="",
        production=False,
        app_debug=False,
    )


def test_click_refund_mock_in_sandbox():
    client = ClickMerchantClient(_sandbox_settings())
    result = asyncio.run(client.refund_payment(payment_id="sandbox-pay-999"))
    assert result["error_code"] == 0
    assert result["mock"] is True
    assert result["payment_id"] == "sandbox-pay-999"


def test_order_status_email_html_escapes():
    html = build_order_status_html(
        title="Olib ketishga tayyor!",
        body="QR <test>",
        product_name="Ko'ylak",
        order_url="https://bozorliii.uz/orders/abc",
    )
    assert "&lt;test&gt;" in html
    assert "Ko'ylak" in html
    assert "https://bozorliii.uz/orders/abc" in html


@pytest.mark.asyncio
async def test_order_refund_skips_cash_order():
    session = AsyncMock()
    order = MagicMock()
    order.id = "00000000-0000-0000-0000-000000000001"
    order.payment_method = "cash"

    svc = OrderRefundService(session)
    result = await svc.refund_cancelled_order(order)
    assert result["status"] == "skipped"
    assert result["reason"] == "not_online_payment"


@pytest.mark.asyncio
async def test_order_refund_skips_unpaid_checkout():
    session = AsyncMock()
    order = MagicMock()
    order.id = "00000000-0000-0000-0000-000000000002"
    order.payment_method = "click"

    with patch.object(OrderRefundService, "__init__", lambda self, s: None):
        svc = OrderRefundService(session)
        svc._session = session
        svc._checkout_repo = AsyncMock()
        svc._click = AsyncMock()
        svc._checkout_repo.find_latest_for_order.return_value = MagicMock(status="pending")

        result = await svc.refund_cancelled_order(order)
        assert result["status"] == "skipped"
        assert result["reason"] == "checkout_not_paid"


@pytest.mark.asyncio
async def test_order_refund_paid_click_mock_flow():
    from uuid import uuid4

    session = AsyncMock()
    order = MagicMock()
    order.id = uuid4()
    order.payment_method = "click"

    checkout = MagicMock()
    checkout.status = "success"
    checkout.provider = "click"
    checkout.provider_trans_id = "click-tx-42"
    checkout.meta = {}
    checkout.id = uuid4()

    with patch.object(OrderRefundService, "__init__", lambda self, s: None):
        svc = OrderRefundService(session)
        svc._session = session
        svc._checkout_repo = AsyncMock()
        svc._click = AsyncMock()
        svc._checkout_repo.find_latest_for_order.return_value = checkout
        svc._click.refund_payment.return_value = {"error_code": 0, "mock": True}

        with patch(
            "app.application.payments.order_refund_service.TransactionSplitterService"
        ) as splitter_cls:
            splitter_cls.return_value.refund_order_payment = AsyncMock(
                side_effect=Exception("platform_transaction_not_found")
            )
            # Use real TransactionSplitterError
            from app.application.finance.transaction_splitter import TransactionSplitterError

            splitter_cls.return_value.refund_order_payment = AsyncMock(
                side_effect=TransactionSplitterError("platform_transaction_not_found")
            )

            result = await svc.refund_cancelled_order(order)

    assert result["status"] == "ok"
    assert result["payment_id"] == "click-tx-42"
    svc._click.refund_payment.assert_awaited_once_with(payment_id="click-tx-42")
    assert checkout.status == "refunded"
    assert checkout.meta.get("refunded_at")
