"""Multicard "Выплаты на карту" (payout) adapteri — to'liq avtomatik rejim.

Oqim (Multicard partner payout):
  1. token olinadi (app_id + secret)
  2. payout/create -> partner depozitidan Uzcard/Humo kartaga chiqim
  3. status tekshiriladi

DIQQAT: aniq endpoint yo'llari va maydon nomlari Multicard biznes kabinetidan
(docs.multicard.uz) olingan spetsifikatsiyaga moslab tasdiqlanadi. Hozircha mock
rejimda to'liq ishlaydi; haqiqiy kredlar berilganda real chaqiriladi.

Bu adapter ishlashi uchun YaTT/MChJ + Multicard bilan payout shartnomasi va
oldindan to'ldirilgan depozit kerak.
"""
from __future__ import annotations

import time
from decimal import Decimal
from uuid import UUID

import httpx
from loguru import logger

from app.core.config import Settings, get_settings
from app.domain.interfaces.payout_gateway import PayoutResult


class MulticardPayoutGateway:
    name = "multicard"
    is_automatic = True

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._timeout = float(self._settings.external_api_timeout_seconds)
        self._token: str | None = None
        self._token_exp: float = 0.0

    @property
    def base_url(self) -> str:
        return (self._settings.multicard_payout_base_url or "").rstrip("/")

    @property
    def is_configured(self) -> bool:
        return bool(
            self.base_url
            and (self._settings.multicard_payout_app_id or "").strip()
            and (self._settings.multicard_payout_secret or "").strip()
        )

    def _use_mock(self) -> bool:
        if self._settings.multicard_payout_mock:
            return True
        return not self.is_configured

    async def _auth_token(self) -> str:
        now = time.time()
        if self._token and now < self._token_exp - 30:
            return self._token
        body = {
            "application_id": (self._settings.multicard_payout_app_id or "").strip(),
            "secret": (self._settings.multicard_payout_secret or "").strip(),
        }
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(f"{self.base_url}/auth", json=body)
        if resp.status_code >= 400:
            raise RuntimeError(f"multicard_auth_http_{resp.status_code}")
        data = resp.json()
        token = str((data.get("data") or data).get("token") or "")
        if not token:
            raise RuntimeError("multicard_auth_no_token")
        self._token = token
        self._token_exp = now + 600
        return token

    async def send_payout(
        self,
        *,
        payout_id: UUID,
        card_number: str,
        amount_uzs: Decimal,
        note: str | None = None,
    ) -> PayoutResult:
        if self._use_mock():
            logger.bind(payout_id=str(payout_id)).info("multicard payout (mock)")
            return PayoutResult(
                status="completed",
                reference=f"mc-mock-{str(payout_id)[:8]}",
                raw={"mock": True},
            )
        try:
            token = await self._auth_token()
            body = {
                "card": card_number,
                "amount": int(Decimal(amount_uzs) * 100),  # tiyin
                "ext_id": str(payout_id),
            }
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    f"{self.base_url}/payout",
                    json=body,
                    headers={"Authorization": f"Bearer {token}"},
                )
            if resp.status_code >= 400:
                return PayoutResult(status="failed", error=f"http_{resp.status_code}", raw={"text": resp.text[:300]})
            data = resp.json()
            payload = data.get("data") or data
            ref = str(payload.get("uuid") or payload.get("transaction_id") or payload.get("id") or "")
            state = str(payload.get("status") or "completed").lower()
            ok = state in ("completed", "success", "paid", "ok")
            return PayoutResult(
                status="completed" if ok else "pending",
                reference=ref or None,
                raw=payload if isinstance(payload, dict) else {},
            )
        except Exception as exc:  # noqa: BLE001
            logger.bind(payout_id=str(payout_id)).exception("multicard payout failed")
            return PayoutResult(status="failed", error=type(exc).__name__)
