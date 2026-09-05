from __future__ import annotations

import uuid


def parse_callback_int(value: str | None, *, minimum: int = 0, maximum: int = 10_000) -> int | None:
    """Parse a bounded integer from untrusted Telegram callback data."""
    if not value or not value.isascii() or not value.isdecimal():
        return None
    parsed = int(value)
    return parsed if minimum <= parsed <= maximum else None


def parse_callback_uuid(value: str | None) -> uuid.UUID | None:
    """Parse a UUID from untrusted or stale Telegram callback data."""
    try:
        return uuid.UUID(value or "")
    except (AttributeError, TypeError, ValueError):
        return None