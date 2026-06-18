"""Unpaid order expiry Celery task — unit smoke."""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


@pytest.mark.asyncio
async def test_expire_unpaid_cancels_stale_orders():
    from app.infrastructure.tasks.order_expiry_tasks import _expire_async

    order = MagicMock()
    order.id = uuid4()
    order.status = "pending_payment"
    order.payment_method = "click"
    order.created_at = datetime(2020, 1, 1, tzinfo=timezone.utc)
    order.note = ""

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [order]
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.commit = AsyncMock()

    with patch(
        "app.infrastructure.tasks.order_expiry_tasks.AsyncSessionFactory"
    ) as factory, patch(
        "app.infrastructure.tasks.order_expiry_tasks.release_order_reserved_stock",
        new=AsyncMock(return_value=True),
    ):
        factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        factory.return_value.__aexit__ = AsyncMock(return_value=None)
        summary = await _expire_async()

    assert summary["cancelled"] == 1
    assert summary["stock_released"] == 1
    assert order.status == "cancelled"
