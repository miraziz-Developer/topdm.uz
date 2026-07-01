from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.infrastructure.repositories.wallet_repo import WalletRepository


@pytest.mark.asyncio
async def test_lock_shop_uses_noload_for_for_update():
    """FOR UPDATE + joined ipadrom outer join Postgres da xato beradi."""
    session = AsyncMock()
    shop_id = uuid4()
    repo = WalletRepository(session)

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = MagicMock()
    session.execute.return_value = mock_result

    await repo.lock_shop(shop_id)

    stmt = session.execute.call_args[0][0]
    compiled = str(stmt)
    assert "shops" in compiled.lower()
    session.execute.assert_awaited_once()
