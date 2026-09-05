import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.infrastructure.bots.callback_payload import parse_callback_int, parse_callback_uuid
from app.infrastructure.bots.merchant_order_handlers import on_order_action
from app.infrastructure.bots.merchant_product_handlers import prod_edit_name, prod_toggle_size


def test_parse_callback_int_accepts_only_bounded_numbers() -> None:
    assert parse_callback_int("0") == 0
    assert parse_callback_int("12", maximum=12) == 12
    assert parse_callback_int("-1") is None
    assert parse_callback_int("+1") is None
    assert parse_callback_int(" 1") is None
    assert parse_callback_int("١") is None
    assert parse_callback_int("13", maximum=12) is None
    assert parse_callback_int("not-a-number") is None
    assert parse_callback_int(None) is None


def test_parse_callback_uuid_rejects_malformed_payloads() -> None:
    value = uuid.uuid4()
    assert parse_callback_uuid(str(value)) == value
    assert parse_callback_uuid("not-a-uuid") is None
    assert parse_callback_uuid("") is None
    assert parse_callback_uuid(None) is None


@pytest.mark.asyncio
async def test_product_edit_callback_rejects_bad_uuid_without_changing_state() -> None:
    query = SimpleNamespace(data="prod:name:not-a-uuid", answer=AsyncMock(), message=None)
    state = SimpleNamespace(set_state=AsyncMock(), update_data=AsyncMock())

    await prod_edit_name(query, state)

    query.answer.assert_awaited_once()
    assert query.answer.await_args.kwargs == {"show_alert": True}
    state.set_state.assert_not_awaited()
    state.update_data.assert_not_awaited()


@pytest.mark.asyncio
async def test_product_size_callback_rejects_bad_uuid_without_database_access() -> None:
    query = SimpleNamespace(data="prod:sz:not-a-uuid:XL", answer=AsyncMock(), message=None)
    state = SimpleNamespace()

    await prod_toggle_size(query, state)

    query.answer.assert_awaited_once()
    assert query.answer.await_args.kwargs == {"show_alert": True}


@pytest.mark.asyncio
async def test_order_callback_rejects_bad_uuid() -> None:
    query = SimpleNamespace(
        data="ord:c:not-a-uuid",
        answer=AsyncMock(),
        message=SimpleNamespace(chat=SimpleNamespace(id=1)),
        from_user=SimpleNamespace(id=1),
    )

    await on_order_action(query)

    query.answer.assert_awaited_once_with("Buyurtma topilmadi", show_alert=True)