from __future__ import annotations

from typing import Any

import httpx
from loguru import logger

from app.core.config import Settings, get_settings


class BtsTrackingClient:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._timeout = float(self._settings.external_api_timeout_seconds)

    async def track(self, tracking_number: str) -> dict[str, Any]:
        tn = (tracking_number or "").strip()
        if not tn:
            return {"status": "unknown"}

        if self._settings.tdb_bts_api_mock:
            return {"status": "delivered", "tracking_number": tn, "source": "mock"}

        base = self._settings.tdb_bts_api_base_url.rstrip("/")
        url = f"{base}/track/{tn}"
        headers: dict[str, str] = {}
        if self._settings.tdb_bts_api_token:
            headers["Authorization"] = f"Bearer {self._settings.tdb_bts_api_token}"

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(url, headers=headers)
            if resp.status_code >= 400:
                logger.warning("bts_track_http status={} tracking={}", resp.status_code, tn)
                return {"status": "pending", "raw": resp.text[:200]}
            data = resp.json()
            status = str(data.get("status") or data.get("delivery_status") or "pending").lower()
            return {"status": status, "raw": data}
        except httpx.HTTPError as exc:
            logger.warning("bts_track_failed tracking={} err={}", tn, exc)
            return {"status": "error", "error": str(exc)}
