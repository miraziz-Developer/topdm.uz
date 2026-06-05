from __future__ import annotations

from uuid import UUID

from app.core.config import Settings


def build_click_p2p_url(*, order_id: UUID, amount_uzs: int, settings: Settings) -> str:
    card = (settings.tdb_click_p2p_card_number or "").strip().replace(" ", "")
    if not card:
        raise ValueError("click_p2p_card_not_configured")
    comment = f"id_{order_id}"
    return f"https://click.uz/p2p/{card}?amount={int(amount_uzs)}&comment={comment}"
