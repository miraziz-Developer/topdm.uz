"""Merchant joylashuvini bozor / bino / qator / do‘kon raqamiga ajratish."""

from __future__ import annotations

import re
from typing import Any

BLOCK_LETTERS = ("A", "B", "C", "D")

_YOLAK_RE = re.compile(r"yo['’`ʼ]?lak|yo['’`ʼ]?lagi|qator", re.I)
_BUILDING_RE = re.compile(r"blok|bino|glavniy|bozor|sector|sektor|pavilon|koridor", re.I)
_QAVAT_RE = re.compile(r"(\d)\s*-?\s*qavat", re.I)


def _clean(text: str | None) -> str:
    return (text or "").strip()


_RASTA_RE = re.compile(r"rasta\s+([A-Za-z0-9\-]+)", re.I)
_ALNUM_STALL_RE = re.compile(r"\b([A-Z]{1,3}\d{1,4})\b", re.I)
_STALL_MAX_LEN = 16


def _normalize_stall_token(raw: str) -> str:
    token = raw.strip()
    if len(token) <= _STALL_MAX_LEN:
        return token
    return token[:_STALL_MAX_LEN]


def _extract_shop_number(section: str | None) -> str | None:
    raw = _clean(section)
    if not raw:
        return None
    m = _RASTA_RE.search(raw)
    if m:
        return _normalize_stall_token(m.group(1))
    m = re.search(r"(\d{1,4})\s*-?\s*do['’`]?kon", raw, re.I) or re.search(r"\b(\d{1,4})\b", raw)
    if m:
        return m.group(1)
    m = _ALNUM_STALL_RE.search(raw)
    if m:
        return _normalize_stall_token(m.group(1).upper())
    if "•" in raw:
        tail = raw.split("•")[-1].strip()
        nested = _extract_shop_number(tail)
        if nested:
            return nested
    return _normalize_stall_token(raw)


def _extract_block_letter(*sources: str | None) -> str | None:
    raw = " ".join(s for s in sources if s and _clean(s))
    if not raw:
        return None
    m = (
        re.search(r"(?:^|[\s,])([A-D])\s*-?\s*blok", raw, re.I)
        or re.search(r"\bblok\s*([A-D])\b", raw, re.I)
        or re.search(r"\b([A-D])\s*-?\s*blok\b", raw, re.I)
    )
    if m:
        letter = m.group(1).upper()
        return letter if letter in BLOCK_LETTERS else None
    return None


def _extract_floor_level(*sources: str | None) -> int | None:
    for src in sources:
        t = _clean(src)
        if not t or "qavat" not in t.lower():
            continue
        m = _QAVAT_RE.search(t)
        if m:
            return int(m.group(1))
    return None


def _is_row_label(text: str) -> bool:
    t = _clean(text)
    if not t:
        return False
    if _YOLAK_RE.search(t):
        return True
    if re.search(r"^\d{1,2}\s*-?\s*(yo|yo['’`])", t, re.I):
        return True
    return False


def _is_building_label(text: str) -> bool:
    t = _clean(text)
    if not t:
        return False
    if _is_row_label(t):
        return False
    if _BUILDING_RE.search(t):
        return True
    if re.search(r"^\d{1,2}\s*-?\s*blok", t, re.I):
        return True
    if re.search(r"glavniy", t, re.I):
        return True
    return False


def _pick_row(*sources: str | None) -> str | None:
    for src in sources:
        t = _clean(src)
        if t and _is_row_label(t):
            return t
    return None


def _pick_building(*sources: str | None) -> str | None:
    for src in sources:
        t = _clean(src)
        if t and _is_building_label(t):
            return t
    return None


def parse_merchant_location(shop) -> dict[str, Any]:
    """
    DB maydonlari:
    - market_zone: Abu Sahiy, Ippodrom, Kozgalovka
    - block_sector: Chorsu bloki, 3-Blok, Toshkent yo'lagi
    - floor: 5-yo'lak, 1-Glavniy, 2-yo'lak (ko‘pincha qator / bino nomi)
    - section: 112-do'kon
    - location_comment: to‘liq matn
    """
    market_zone = _clean(getattr(shop, "market_zone", None))
    block_sector = _clean(getattr(shop, "block_sector", None))
    floor_field = _clean(getattr(shop, "floor", None))
    section = _clean(getattr(shop, "section", None))
    location_comment = _clean(getattr(shop, "location_comment", None))

    ipadrom = getattr(shop, "ipadrom", None)
    market = market_zone or (
        str(ipadrom.name).replace(" bozori", "").replace(" bozor", "").strip()
        if ipadrom and getattr(ipadrom, "name", None)
        else "Ippodrom"
    )

    row_label = _pick_row(floor_field, block_sector, location_comment, section)
    building = _pick_building(block_sector, floor_field, location_comment)

    if building and row_label and building == row_label:
        if _is_row_label(block_sector):
            building = _pick_building(floor_field, location_comment)
        else:
            row_label = _pick_row(floor_field, location_comment)

    block_letter = _extract_block_letter(block_sector, floor_field, section, location_comment)
    floor_level = _extract_floor_level(floor_field, location_comment, block_sector)
    shop_number = _extract_shop_number(section) or _extract_shop_number(location_comment)

    stall = shop_number
    if not stall and block_letter:
        stall = str(8 + (ord(block_letter) % 4) * 3)
    if stall and stall != "—":
        stall = _normalize_stall_token(str(stall))

    parts: list[str] = [market]
    if building:
        parts.append(building)
    elif block_letter:
        parts.append(f"{block_letter}-blok")
    if row_label:
        parts.append(row_label)
    if floor_level:
        parts.append(f"{floor_level}-qavat")
    if shop_number:
        parts.append(f"{shop_number}-do'kon")

    address_label = " • ".join(parts) if len(parts) > 1 else (location_comment or f"{market}")

    return {
        "market_zone": market,
        "building": building,
        "block_id": block_letter,
        "row_label": row_label,
        "floor_level": floor_level,
        "stall_number": stall or "—",
        "shop_number": section or shop_number,
        "address_label": address_label,
        "location_comment": location_comment or None,
    }
