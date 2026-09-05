"""Regression tests for stylist chat image input validation."""

from __future__ import annotations

import base64

import pytest
from fastapi import HTTPException

from app.interfaces.api.chat_agent_routes import ChatAgentTurnBody, _decode_optional_image


def _body(image_base64: str, image_mime: str | None = None) -> ChatAgentTurnBody:
    return ChatAgentTurnBody(user_id="test-user", image_base64=image_base64, image_mime=image_mime)


def test_chat_image_uses_detected_mime_not_claimed_mime():
    jpeg = b"\xff\xd8\xff\xe0" + b"\x00" * 20
    data, mime = _decode_optional_image(
        _body(base64.b64encode(jpeg).decode("ascii"), image_mime="image/png")
    )

    assert data == jpeg
    assert mime == "image/jpeg"


def test_chat_image_rejects_invalid_base64():
    with pytest.raises(HTTPException) as exc:
        _decode_optional_image(_body("not_valid_***"))

    assert exc.value.status_code == 400
    assert exc.value.detail == "Invalid base64 image"


def test_chat_image_rejects_non_image_payload():
    fake = base64.b64encode(b"this is not an image").decode("ascii")

    with pytest.raises(HTTPException) as exc:
        _decode_optional_image(_body(fake, image_mime="image/jpeg"))

    assert exc.value.status_code == 400
    assert "formati" in str(exc.value.detail)