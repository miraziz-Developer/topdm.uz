from __future__ import annotations

from typing import Any

import httpx
from loguru import logger

from app.core.config import Settings, get_settings


class P2pProviderClient:
    """Norasmiy P2P transfer API — productionda haqiqiy provayder."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._timeout = float(self._settings.external_api_timeout_seconds)

    async def transfer(
        self,
        *,
        to_card: str,
        amount_uzs: int,
        purpose: str,
    ) -> dict[str, Any]:
        card = (to_card or "").replace(" ", "")
        amount = int(amount_uzs)
        if amount <= 0:
            return {"ok": True, "skipped": True}

        if self._settings.tdb_p2p_provider_mock:
            logger.info(
                "tdb_p2p_transfer_mock card={} amount={} purpose={}",
                card[-4:].rjust(len(card), "*") if len(card) > 4 else "****",
                amount,
                purpose,
            )
            return {"ok": True, "mock": True, "transaction_id": f"mock-{purpose}"}

        url = self._settings.tdb_p2p_provider_url.rstrip("/") + "/v1/p2p/transfer"
        payload = {
            "to_card": card,
            "amount": amount,
            "currency": "UZS",
            "purpose": purpose,
        }
        headers = {"Content-Type": "application/json"}
        if self._settings.tdb_p2p_provider_api_key:
            headers["Authorization"] = f"Bearer {self._settings.tdb_p2p_provider_api_key}"

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code >= 400:
            logger.error("p2p_provider_failed status={} body={}", resp.status_code, resp.text[:300])
            raise RuntimeError(f"p2p_provider_http_{resp.status_code}")
        return resp.json()
