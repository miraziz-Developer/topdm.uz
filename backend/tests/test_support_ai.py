from app.application.merchant.support_ai_service import _normalize_telegram_username, _telegram_public


def test_normalize_telegram_username():
    assert _normalize_telegram_username("@BozorAdmin") == "BozorAdmin"
    assert _normalize_telegram_username("BozorAdmin") == "BozorAdmin"
    assert _normalize_telegram_username("") == ""
    assert _normalize_telegram_username("bad name") == ""


def test_telegram_public():
    handle, url = _telegram_public("BozorAdmin")
    assert handle == "@BozorAdmin"
    assert url == "https://t.me/BozorAdmin"
