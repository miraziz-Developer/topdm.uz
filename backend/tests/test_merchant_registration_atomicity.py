from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.application.merchant.registration import MerchantRegistrationDraft, MerchantRegistrationService


def _draft(*, storefront_file_id: str | None = None) -> MerchantRegistrationDraft:
    return MerchantRegistrationDraft(
        name="Atomic Shop",
        shop_type="chakana",
        market_zone="Ippodrom",
        block_sector="A blok",
        stall_number="12",
        location_comment="Test",
        latitude=41.0,
        longitude=69.0,
        location_accuracy=5.0,
        owner_phone="+998901234567",
        owner_display_name="Owner",
        storefront_file_id=storefront_file_id,
        storefront_image_url=None,
        telegram_chat_id=123,
        telegram_user_id=456,
    )


def _service() -> tuple[MerchantRegistrationService, AsyncMock, SimpleNamespace]:
    session = AsyncMock()
    session.add = MagicMock()
    slug_rows = MagicMock()
    slug_rows.all.return_value = []
    session.execute.return_value = slug_rows
    service = MerchantRegistrationService(session)
    shop = SimpleNamespace(
        id=uuid4(),
        name="Atomic Shop",
        owner_phone="+998901234567",
        verification_status="pending_ai",
        logo_url=None,
        storefront_image_url=None,
        referral_code=None,
        referred_by_shop_id=None,
    )
    service._repo.get_shop_by_owner_phone = AsyncMock(return_value=None)
    service._repo.create_shop = AsyncMock(return_value=shop)
    service._unique_login_code = AsyncMock(return_value="ATOMIC-1234")
    return service, session, shop


@pytest.mark.asyncio
async def test_registration_rolls_back_when_storefront_upload_fails(monkeypatch):
    service, session, _shop = _service()
    resolve = AsyncMock(side_effect=RuntimeError("storage unavailable"))
    monkeypatch.setattr(
        "app.application.merchant.registration.TelegramMediaStore.resolve_permanent_url",
        resolve,
    )

    with pytest.raises(ValueError, match="rasmini saqlab bo'lmadi"):
        await service.register_shop(_draft(storefront_file_id="telegram-file"))

    service._repo.create_shop.assert_awaited_once()
    assert service._repo.create_shop.await_args.kwargs["commit"] is False
    session.rollback.assert_awaited_once()
    session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_registration_rolls_back_credential_failure_and_allows_retry(monkeypatch):
    service, session, _shop = _service()
    hashes = MagicMock(side_effect=[RuntimeError("hash failed"), "valid-hash"])
    resolve = AsyncMock(return_value="/media/products/atomic.jpg")
    cleanup = AsyncMock(return_value=True)
    monkeypatch.setattr("app.application.merchant.registration.hash_password", hashes)
    monkeypatch.setattr(
        "app.application.merchant.registration.TelegramMediaStore.resolve_permanent_url",
        resolve,
    )
    monkeypatch.setattr("app.application.merchant.registration.delete_media_by_url", cleanup)
    monkeypatch.setattr(
        "app.application.merchant.growth_service.MerchantGrowthService.ensure_referral_code",
        AsyncMock(return_value="ATOMIC123"),
    )
    monkeypatch.setattr(
        "app.application.merchant.growth_service.MerchantGrowthService.apply_referral_code",
        AsyncMock(return_value=None),
    )

    with pytest.raises(RuntimeError, match="hash failed"):
        await service.register_shop(_draft(storefront_file_id="telegram-file"))

    session.rollback.assert_awaited_once()
    session.commit.assert_not_awaited()
    cleanup.assert_awaited_once_with("/media/products/atomic.jpg")

    result = await service.register_shop(_draft(storefront_file_id="telegram-file"))

    assert result.login_code == "ATOMIC-1234"
    assert service._repo.create_shop.await_count == 2
    session.commit.assert_awaited_once()