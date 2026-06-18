"""Upload magic-byte validation."""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.core.upload_validation import sniff_image_mime, validate_image_bytes


def test_sniff_jpeg():
    assert sniff_image_mime(b"\xff\xd8\xff\xe0" + b"\x00" * 20) == "image/jpeg"


def test_sniff_png():
    assert sniff_image_mime(b"\x89PNG\r\n\x1a\n" + b"\x00" * 20) == "image/png"


def test_reject_fake_image():
    with pytest.raises(HTTPException) as exc:
        validate_image_bytes(b"not-an-image")
    assert exc.value.status_code == 400
