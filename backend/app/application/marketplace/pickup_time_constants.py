"""Markazlashtirilgan olib ketish vaqt slotlari — barcha modullar shu yerdan import qiladi."""
from __future__ import annotations

PICKUP_TIME_SLOTS: frozenset[str] = frozenset({"09:00", "12:00", "15:00"})

PICKUP_TIME_LABELS: dict[str, str] = {
    "09:00": "09:00 - 11:00 (Ertalab)",
    "12:00": "11:00 - 14:00 (Tushlik)",
    "15:00": "14:00 - 17:00 (Tushdan keyin)",
}
