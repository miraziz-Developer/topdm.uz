"""CRM chat quick reply templates (Uzbek) + do'kon maxsus javoblar."""

from __future__ import annotations

from typing import Any

from app.infrastructure.db.models import ShopModel

QUICK_REPLIES: tuple[dict[str, str], ...] = (
    {"id": "yes_stock", "label": "Bor", "text": "Ha, hozir bor. Keling, ko'rib oling."},
    {"id": "sold_out", "label": "Tugadi", "text": "Afsuski hozir tugagan. Ertaga kelishi mumkin."},
    {"id": "other_color", "label": "Boshqa rang", "text": "Boshqa ranglar ham bor — qaysi rang kerak?"},
    {"id": "price", "label": "Narx", "text": "Narxi katalogdagi narxda. Savol bo'lsa yozing."},
    {"id": "reserve", "label": "Bron", "text": "Bron qilib qo'yaman — 2 soat ichida keling."},
    {"id": "location", "label": "Joy", "text": "Joylashuv xaritada ko'rsatilgan. Bozorliii xaritadan yo'l oling."},
    {"id": "thanks", "label": "Rahmat", "text": "Rahmat! Yordam kerak bo'lsa yozing."},
)


def _custom_from_shop(shop: ShopModel | None) -> list[dict[str, str]]:
    if shop is None:
        return []
    metrics = dict(shop.trust_metrics or {})
    raw = metrics.get("custom_quick_replies")
    if not isinstance(raw, list):
        return []
    out: list[dict[str, str]] = []
    for i, row in enumerate(raw):
        if not isinstance(row, dict):
            continue
        text = str(row.get("text") or "").strip()
        if len(text) < 2:
            continue
        out.append(
            {
                "id": str(row.get("id") or f"custom_{i}"),
                "label": str(row.get("label") or text[:24]),
                "text": text,
                "custom": True,
            }
        )
    return out


def list_quick_replies(shop: ShopModel | None = None) -> list[dict[str, Any]]:
    base = [dict(item) for item in QUICK_REPLIES]
    custom = _custom_from_shop(shop)
    return base + custom


def save_custom_quick_replies(shop: ShopModel, items: list[dict[str, str]]) -> list[dict[str, str]]:
    cleaned: list[dict[str, str]] = []
    for i, row in enumerate(items[:12]):
        text = str(row.get("text") or "").strip()
        if len(text) < 2:
            continue
        cleaned.append(
            {
                "id": str(row.get("id") or f"custom_{i}"),
                "label": str(row.get("label") or text[:24])[:32],
                "text": text[:500],
            }
        )
    metrics = dict(shop.trust_metrics or {})
    metrics["custom_quick_replies"] = cleaned
    shop.trust_metrics = metrics
    return cleaned
