"""BTS Express API — auth, order/create, track.

Hujjat: https://docs.bts.uz/
"""
from __future__ import annotations

import time
from typing import Any

import httpx
from loguru import logger

from app.core.config import Settings, get_settings

_token_cache: dict[str, Any] = {"access": "", "expires_at": 0.0}


class BtsDeliveryAPIError(Exception):
    def __init__(self, message: str, *, status_code: int | None = None, payload: Any = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload


class BtsDeliveryClient:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._timeout = float(self._settings.external_api_timeout_seconds)

    @property
    def base_url(self) -> str:
        raw = (
            (self._settings.bts_api_base_url or "").strip()
            or (self._settings.tdb_bts_api_base_url or "").strip()
            or "https://api.bts.uz"
        )
        return raw.rstrip("/")

    @property
    def is_configured(self) -> bool:
        if self._settings.bts_api_mock or self._settings.tdb_bts_api_mock:
            return True
        if (self._settings.bts_api_token or self._settings.tdb_bts_api_token or "").strip():
            return True
        return bool(
            (self._settings.bts_api_login or "").strip()
            and (self._settings.bts_api_password or "").strip()
        )

    def _use_mock(self) -> bool:
        if self._settings.bts_api_mock or self._settings.tdb_bts_api_mock:
            return True
        if self._settings.is_production:
            return False
        return not self.is_configured

    async def _access_token(self) -> str:
        static = (self._settings.bts_api_token or self._settings.tdb_bts_api_token or "").strip()
        if static:
            return static

        now = time.time()
        cached = str(_token_cache.get("access") or "")
        if cached and float(_token_cache.get("expires_at") or 0) > now + 60:
            return cached

        login = (self._settings.bts_api_login or "").strip()
        password = (self._settings.bts_api_password or "").strip()
        if not login or not password:
            raise BtsDeliveryAPIError("bts_credentials_missing")

        url = f"{self.base_url}/auth/login"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(url, json={"login": login, "password": password})
        if resp.status_code >= 400:
            raise BtsDeliveryAPIError("bts_auth_failed", status_code=resp.status_code, payload=resp.text[:300])
        data = resp.json()
        token = str((data.get("data") or {}).get("access_token") or "")
        if not token:
            raise BtsDeliveryAPIError("bts_auth_token_missing", payload=data)
        _token_cache["access"] = token
        _token_cache["expires_at"] = now + 23 * 3600
        return token

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json_body: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        token = await self._access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "language": "uz",
        }
        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.request(method, url, headers=headers, json=json_body, params=params)
        if resp.status_code >= 400:
            raise BtsDeliveryAPIError(
                f"bts_http_{resp.status_code}",
                status_code=resp.status_code,
                payload=resp.text[:500],
            )
        try:
            data = resp.json()
        except ValueError as exc:
            raise BtsDeliveryAPIError("bts_invalid_json", payload=resp.text[:300]) from exc
        if not isinstance(data, dict):
            raise BtsDeliveryAPIError("bts_invalid_response", payload=data)
        if data.get("status") is False:
            raise BtsDeliveryAPIError(str(data.get("message") or "bts_error"), payload=data)
        return data

    async def calculate_cost(
        self,
        *,
        sender_city_code: str,
        receiver_city_code: str,
        weight_kg: float,
        volume_cm: tuple[float, float, float] | None = None,
        pickup_type: str = "courier",
        dropoff_type: str = "courier",
    ) -> int | None:
        """BTS /v1/order-calculate/index — haqiqiy narx (muvaffaqiyatsiz bo'lsa None)."""
        if self._use_mock():
            return None
        vol = volume_cm or (30.0, 30.0, 10.0)
        body = {
            "senderCityCode": sender_city_code,
            "receiverCityCode": receiver_city_code,
            "pickup_type": pickup_type,
            "dropoff_type": dropoff_type,
            "is_multiple_cost": 0,
            "weight": round(max(0.1, float(weight_kg)), 3),
            "volume": {"x": vol[0], "y": vol[1], "z": vol[2]},
        }
        try:
            data = await self._request("POST", "/v1/order-calculate/index", json_body=body)
        except BtsDeliveryAPIError:
            return None
        inner = data.get("data") if isinstance(data.get("data"), dict) else {}
        for candidate in (
            "courier_to_courier",
            "branch_to_courier",
            "courier_to_branch",
            "branch_to_branch",
        ):
            block = inner.get(candidate)
            if isinstance(block, dict) and block.get("available") and block.get("price"):
                return int(block["price"])
        for block in inner.values():
            if isinstance(block, dict) and block.get("available") and block.get("price"):
                return int(block["price"])
        return None

    async def create_order(self, body: dict[str, Any]) -> dict[str, Any]:
        if self._use_mock():
            import random

            oid = random.randint(10_000_000, 99_999_999)
            cost = int(body.get("_estimate_cost_uzs") or self._settings.finance_delivery_fallback_uzs)
            return {
                "status": True,
                "data": {
                    "orderId": oid,
                    "clientId": body.get("clientId"),
                    "barcode": f"MOCK{oid}",
                    "cost": cost,
                    "tracking": f"https://bts.uz/uz/waybill-tracking?term={oid}",
                },
            }
        data = await self._request("POST", "/v1/order/add", json_body={k: v for k, v in body.items() if not k.startswith("_")})
        return data

    async def track_order(self, order_id: str | int) -> dict[str, Any]:
        oid = str(order_id).strip()
        if not oid:
            return {"status": "unknown"}
        if self._use_mock():
            return {
                "status": "pending",
                "status_code": "100",
                "status_name": "Mock — kutilmoqda",
                "orderId": oid,
                "source": "mock",
            }
        data = await self._request("GET", "/v1/order/track", params={"orderId": oid})
        inner = data.get("data") if isinstance(data.get("data"), dict) else data
        status_obj = inner.get("status") if isinstance(inner, dict) else {}
        code = ""
        name = ""
        if isinstance(status_obj, dict):
            code = str(status_obj.get("code") or "")
            name = str(status_obj.get("name") or "")
        elif isinstance(status_obj, str):
            name = status_obj
        return {
            "orderId": inner.get("orderId") if isinstance(inner, dict) else oid,
            "status_code": code,
            "status_name": name,
            "raw": data,
        }
