"""CRM chat quick reply templates (Uzbek)."""

from __future__ import annotations

QUICK_REPLIES: tuple[dict[str, str], ...] = (
    {"id": "yes_stock", "label": "Bor", "text": "Ha, hozir bor. Keling, ko'rib oling."},
    {"id": "sold_out", "label": "Tugadi", "text": "Afsuski hozir tugagan. Ertaga kelishi mumkin."},
    {"id": "other_color", "label": "Boshqa rang", "text": "Boshqa ranglar ham bor — qaysi rang kerak?"},
    {"id": "price", "label": "Narx", "text": "Narxi katalogdagi narxda. Savol bo'lsa yozing."},
    {"id": "reserve", "label": "Bron", "text": "Bron qilib qo'yaman — 2 soat ichida keling."},
    {"id": "location", "label": "Joy", "text": "Joylashuv xaritada ko'rsatilgan. Bozorliii xaritadan yo'l oling."},
    {"id": "thanks", "label": "Rahmat", "text": "Rahmat! Yordam kerak bo'lsa yozing."},
)


def list_quick_replies() -> list[dict[str, str]]:
    return [dict(item) for item in QUICK_REPLIES]
