"""Q-PAY / PLUM (myuzcard) — self-employed host-to-host acquiring (Uzcard/Humo + OTP).

Oqim (standart UZ host-to-host):
  1. create_payment()  -> transaction yaratiladi
  2. pay_with_card()   -> karta ma'lumoti yuboriladi, mijozga OTP SMS keladi
  3. apply_otp()       -> OTP tasdiqlanadi, pul yechiladi
  4. get_status()      -> holatni tekshirish

DIQQAT: aniq endpoint yo'llari va maydon nomlari PLUM biznes kabinetidan
(business.plum.uz) olinadigan API spetsifikatsiyasiga moslab tasdiqlanadi.
Hozircha mock rejimda to'liq ishlaydi; QPAY_BASE_URL berilganda real chaqiradi.
"""
from __future__ import annotations

import hashlib
import time
import uuid
from typing import Any

import httpx

from app.core.config import Settings, get_settings


class QpayAPIError(Exception):
    def __init__(self, message: str, *, payload: Any = None) -> None:
        super().__init__(message)
        self.payload = payload


class QpayClient:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._timeout = float(self._settings.external_api_timeout_seconds)

    @property
    def base_url(self) -> str:
        return (self._settings.qpay_base_url or "").rstrip("/")

    @property
    def is_configured(self) -> bool:
        return bool(self.base_url and (self._settings.qpay_api_key or "").strip())

    def _use_mock(self) -> bool:
        if self._settings.is_production:
            return False
        return self._settings.payment_sandbox_mode or not self.is_configured

    def _headers(self) -> dict[str, str]:
        return {
            "X-Api-Key": (self._settings.qpay_api_key or "").strip(),
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _sign(self, *parts: str) -> str:
        secret = (self._settings.qpay_secret_key or "").strip()
        raw = "".join(parts) + secret
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    async def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(url, json=body, headers=self._headers())
        if resp.status_code >= 400:
            raise QpayAPIError(f"qpay_http_{resp.status_code}", payload=resp.text[:300])
        try:
            return resp.json()
        except ValueError as exc:
            raise QpayAPIError("qpay_invalid_json", payload=resp.text[:300]) from exc

    async def create_payment(self, *, account: str, amount_uzs: int) -> dict[str, Any]:
        if self._use_mock():
            return {"transaction_id": f"mock-{account}", "status": "created", "mock": True}
        body = {
            "service_id": self._settings.qpay_service_id,
            "merchant_id": self._settings.qpay_merchant_id,
            "account": account,
            "amount": int(amount_uzs) * 100,
            "sign": self._sign(str(self._settings.qpay_merchant_id), account, str(int(amount_uzs) * 100)),
        }
        # TODO: PLUM kabinetidagi aniq endpoint bilan tasdiqlang.
        return await self._post("/payment/create", body)

    async def pay_with_card(self, *, transaction_id: str, pan: str, expiry: str) -> dict[str, Any]:
        """Karta ma'lumoti -> mijozga OTP SMS yuboriladi."""
        if self._use_mock():
            return {"transaction_id": transaction_id, "otp_sent": True, "phone_mask": "+9989******99", "mock": True}
        body = {"transaction_id": transaction_id, "pan": pan, "expiry": expiry}
        return await self._post("/payment/pay", body)

    async def apply_otp(self, *, transaction_id: str, otp: str) -> dict[str, Any]:
        """OTP tasdiqlash -> pul yechiladi."""
        if self._use_mock():
            return {
                "transaction_id": transaction_id,
                "status": "paid",
                "paid_amount": None,
                "rrn": str(uuid.uuid4())[:12],
                "mock": True,
            }
        body = {"transaction_id": transaction_id, "otp": otp}
        return await self._post("/payment/confirm", body)

    async def get_status(self, transaction_id: str) -> dict[str, Any]:
        if self._use_mock():
            return {"transaction_id": transaction_id, "status": "paid", "mock": True}
        body = {"transaction_id": transaction_id, "ts": str(int(time.time()))}
        return await self._post("/payment/status", body)
