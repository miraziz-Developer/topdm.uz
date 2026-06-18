"""Uzbekistan phone normalization (+998XXXXXXXXX)."""
from __future__ import annotations

import re

_PHONE_RE = re.compile(r"^\+998\d{9}$")


def normalize_uz_phone_e164(phone: str | None) -> str | None:
    """Return canonical +998XXXXXXXXX or None if not a valid UZ mobile."""
    if not phone or not str(phone).strip():
        return None
    digits = re.sub(r"\D", "", str(phone))
    if digits.startswith("998") and len(digits) >= 12:
        candidate = f"+{digits[:12]}"
    elif len(digits) == 9:
        candidate = f"+998{digits}"
    else:
        candidate = str(phone).strip()
    return candidate if _PHONE_RE.match(candidate) else None


def phone_digits_key(phone: str | None) -> str:
    """Digits-only key for legacy DB rows (998XXXXXXXXX)."""
    return re.sub(r"\D", "", phone or "")
