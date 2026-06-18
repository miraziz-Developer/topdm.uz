"""Click Business Merchant API — invoice (Click ilovasiga push) + hosted to'lov sahifasi.

Click Business (o'zini o'zi band qilgan shaxslar uchun ham) bir xil SHOP API sxemasida
ishlaydi: service_id + secret_key + merchant_id. Callback allaqachon /payments/callback/click
da qayta ishlanadi. Bu modul qo'shimcha 2 imkoniyat beradi:

1. build_click_pay_url() — rasmiy my.click.uz to'lov sahifasiga redirect (web checkout).
2. ClickMerchantClient.create_invoice() — mijoz Click ilovasiga to'lov so'rovi (push).

Hujjat: https://docs.click.uz/
"""
from __future__ import annotations

import hashlib
import time
from typing import Any
from urllib.parse import urlencode

import httpx
from loguru import logger

from app.core.config import Settings, get_settings


def _merchant_credentials(settings: Settings) -> tuple[str, str]:
    """(service_id, secret_key) — sandbox yoki haqiqiy."""
    if settings.payment_sandbox_mode:
        return (
            (settings.payment_sandbox_click_service_id or "").strip(),
            (settings.payment_sandbox_click_secret_key or "").strip(),
        )
    return ((settings.click_service_id or "").strip(), (settings.click_secret_key or "").strip())


def build_click_pay_url(
    *,
    amount_uzs: int,
    transaction_param: str,
    return_url: str = "",
    card_type: str | None = None,
    settings: Settings | None = None,
) -> str:
    """Rasmiy Click to'lov sahifasi havolasi (self-employed Click Business uchun ham)."""
    cfg = settings or get_settings()
    service_id = _merchant_credentials(cfg)[0]
    merchant_id = (cfg.click_merchant_id or "").strip()
    base = (cfg.click_pay_base_url or "https://my.click.uz/services/pay").rstrip("/")
    params: dict[str, Any] = {
        "service_id": service_id,
        "merchant_id": merchant_id,
        "amount": f"{int(amount_uzs)}.00",
        "transaction_param": transaction_param,
    }
    if return_url:
        params["return_url"] = return_url
    if card_type:
        params["card_type"] = card_type
    return f"{base}?{urlencode(params)}"


class ClickMerchantAPIError(Exception):
    def __init__(self, message: str, *, payload: Any = None) -> None:
        super().__init__(message)
        self.payload = payload


class ClickMerchantClient:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._timeout = float(self._settings.external_api_timeout_seconds)

    @property
    def base_url(self) -> str:
        return (self._settings.click_api_base_url or "https://api.click.uz/v2/merchant").rstrip("/")

    def _use_mock(self) -> bool:
        if self._settings.is_production:
            return False
        if self._settings.payment_sandbox_mode:
            return True
        return not (self._settings.click_merchant_user_id or "").strip()

    def _auth_header(self) -> str:
        """Auth: merchant_user_id:sha1(timestamp+secret_key):timestamp."""
        secret = _merchant_credentials(self._settings)[1]
        user_id = (self._settings.click_merchant_user_id or "").strip()
        ts = str(int(time.time()))
        digest = hashlib.sha1(f"{ts}{secret}".encode("utf-8")).hexdigest()
        return f"{user_id}:{digest}:{ts}"

    async def create_invoice(
        self,
        *,
        amount_uzs: int,
        phone_number: str,
        merchant_trans_id: str,
    ) -> dict[str, Any]:
        """Click ilovasiga to'lov so'rovi yuboradi (mijoz telefon raqami bo'yicha)."""
        if self._use_mock():
            return {
                "error_code": 0,
                "error_note": "Success (mock)",
                "invoice_id": int(time.time()),
                "mock": True,
            }
        service_id = _merchant_credentials(self._settings)[0]
        body = {
            "service_id": int(service_id),
            "amount": float(int(amount_uzs)),
            "phone_number": phone_number,
            "merchant_trans_id": merchant_trans_id,
        }
        url = f"{self.base_url}/invoice/create"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(
                url,
                json=body,
                headers={
                    "Auth": self._auth_header(),
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
            )
        if resp.status_code >= 400:
            raise ClickMerchantAPIError("click_invoice_http_error", payload=resp.text[:300])
        data = resp.json()
        if int(data.get("error_code", -1)) != 0:
            raise ClickMerchantAPIError(str(data.get("error_note") or "click_invoice_failed"), payload=data)
        return data

    async def invoice_status(self, invoice_id: str | int) -> dict[str, Any]:
        if self._use_mock():
            return {"error_code": 0, "invoice_status": 2, "mock": True}
        service_id = _merchant_credentials(self._settings)[0]
        url = f"{self.base_url}/invoice/status/{service_id}/{invoice_id}"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.get(
                url,
                headers={"Auth": self._auth_header(), "Accept": "application/json"},
            )
        if resp.status_code >= 400:
            raise ClickMerchantAPIError("click_invoice_status_http_error", payload=resp.text[:300])
        return resp.json()
