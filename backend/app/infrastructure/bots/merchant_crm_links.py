"""Merchant bot ↔ CRM WebApp havolalari (ilovasiz yagona tizim)."""

from __future__ import annotations

import uuid
from urllib.parse import quote

from app.core.config import get_settings


def crm_entry_url(shop_id: uuid.UUID | None = None, *, next_path: str | None = None) -> str:
    """Barcha Telegram bildirishnomalar shu eshik orqali CRM ga kiradi."""
    base = get_settings().merchant_crm_webapp_url.rstrip("/")
    params: list[str] = []
    if shop_id:
        params.append(f"shop_id={shop_id}")
    if next_path:
        params.append(f"next={quote(next_path, safe='/')}")
    qs = "&".join(params)
    return f"{base}/telegram{f'?{qs}' if qs else ''}"


def crm_webapp_reply_markup(shop_id: uuid.UUID, *, next_path: str | None = None) -> dict:
    return {
        "inline_keyboard": [
            [
                {
                    "text": "📱 CRM ochish",
                    "web_app": {"url": crm_entry_url(shop_id, next_path=next_path)},
                }
            ]
        ]
    }
