from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.core.config import get_settings
from app.infrastructure.auth.jwt import create_access_token, decode_access_token


def test_access_token_round_trip(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET", "test-secret-that-is-at-least-32-characters")
    monkeypatch.setenv("JWT_ALGORITHM", "HS256")
    get_settings.cache_clear()
    try:
        token = create_access_token(subject="user-123", role="merchant", email="owner@example.com")
        payload = decode_access_token(token)
        assert payload["sub"] == "user-123"
        assert payload["role"] == "merchant"
        assert payload["email"] == "owner@example.com"
    finally:
        get_settings.cache_clear()


def test_access_token_rejects_wrong_signature(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET", "test-secret-that-is-at-least-32-characters")
    get_settings.cache_clear()
    try:
        token = jwt.encode(
            {"sub": "user-123", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
            "a-different-secret-that-is-long-enough",
            algorithm="HS256",
        )
        with pytest.raises(jwt.InvalidSignatureError):
            decode_access_token(token)
    finally:
        get_settings.cache_clear()


def test_access_token_rejects_expired_token(monkeypatch: pytest.MonkeyPatch) -> None:
    secret = "test-secret-that-is-at-least-32-characters"
    monkeypatch.setenv("JWT_SECRET", secret)
    get_settings.cache_clear()
    try:
        token = jwt.encode(
            {"sub": "user-123", "exp": datetime.now(timezone.utc) - timedelta(seconds=1)},
            secret,
            algorithm="HS256",
        )
        with pytest.raises(jwt.ExpiredSignatureError):
            decode_access_token(token)
    finally:
        get_settings.cache_clear()