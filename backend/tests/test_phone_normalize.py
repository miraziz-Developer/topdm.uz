from app.core.phone import normalize_uz_phone_e164, phone_digits_key


def test_normalize_uz_phone_e164() -> None:
    assert normalize_uz_phone_e164("+998901234567") == "+998901234567"
    assert normalize_uz_phone_e164("998901234567") == "+998901234567"
    assert normalize_uz_phone_e164("901234567") == "+998901234567"
    assert normalize_uz_phone_e164("invalid") is None


def test_phone_digits_key() -> None:
    assert phone_digits_key("+998 (90) 123-45-67") == "998901234567"
