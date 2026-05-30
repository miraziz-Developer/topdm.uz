from __future__ import annotations


def digits_only(phone: str) -> str:
    return "".join(c for c in phone if c.isdigit())


def phones_match(owner_phone: str, contact_phone: str) -> bool:
    """Loose match for Uzbek numbers (last 9 digits)."""
    a = digits_only(owner_phone)
    b = digits_only(contact_phone)
    if len(a) >= 9 and len(b) >= 9:
        return a[-9:] == b[-9:]
    return a == b and bool(a)
