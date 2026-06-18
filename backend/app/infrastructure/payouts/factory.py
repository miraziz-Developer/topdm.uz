"""Sozlamaga qarab payout gateway tanlash."""
from __future__ import annotations

from app.core.config import Settings, get_settings
from app.domain.interfaces.payout_gateway import PayoutGateway
from app.infrastructure.payouts.batch_gateway import BatchPayoutGateway
from app.infrastructure.payouts.multicard_gateway import MulticardPayoutGateway


def get_payout_gateway(settings: Settings | None = None) -> PayoutGateway:
    cfg = settings or get_settings()
    mode = (cfg.payout_mode or "batch").strip().lower()
    if mode == "auto":
        provider = (cfg.payout_provider or "multicard").strip().lower()
        if provider == "multicard":
            return MulticardPayoutGateway(cfg)
        # Boshqa provayderlar (uzum/atmos) shu yerga qo'shiladi.
        return MulticardPayoutGateway(cfg)
    return BatchPayoutGateway()
