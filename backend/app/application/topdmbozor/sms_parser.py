"""Click P2P bank SMS matnidan order_id va summa ajratish."""

from __future__ import annotations

import re
from dataclasses import dataclass
from uuid import UUID

ORDER_ID_RE = re.compile(r"id_([0-9a-fA-F-]{36})", re.IGNORECASE)
# 150 000, 150000, 150,000.00 UZS / sum / so'm
AMOUNT_RE = re.compile(
    r"(?:summa|amount|o[''`]?tkazma|перевод|p2p)[^\d]{0,20}(\d[\d\s]{2,12})|"
    r"(\d{1,3}(?:[\s,]\d{3})+)\s*(?:uzs|sum|so[''`]?m|сум)?",
    re.IGNORECASE,
)


@dataclass(frozen=True, slots=True)
class ParsedSmsPayment:
    order_id: UUID
    amount_uzs: int


def parse_click_p2p_sms(text: str) -> ParsedSmsPayment | None:
    raw = (text or "").strip()
    if not raw:
        return None

    id_match = ORDER_ID_RE.search(raw)
    if not id_match:
        return None

    try:
        order_id = UUID(id_match.group(1))
    except ValueError:
        return None

    amount = _extract_amount_uzs(raw)
    if amount is None or amount <= 0:
        return None

    return ParsedSmsPayment(order_id=order_id, amount_uzs=amount)


def _extract_amount_uzs(text: str) -> int | None:
    candidates: list[int] = []
    for m in AMOUNT_RE.finditer(text):
        g = m.group(1) or m.group(2) or ""
        digits = re.sub(r"\D", "", g)
        if not digits:
            continue
        val = int(digits)
        if 1000 <= val <= 500_000_000:
            candidates.append(val)
    if not candidates:
        # Fallback: eng katta 4+ xonali raqam (order id UUID dan tashqari)
        for chunk in re.findall(r"\d{4,12}", text):
            val = int(chunk)
            if 1000 <= val <= 500_000_000:
                candidates.append(val)
    return max(candidates) if candidates else None
