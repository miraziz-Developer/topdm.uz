from __future__ import annotations

import ipaddress
from typing import Any

from fastapi import HTTPException, Request

from app.application.payments.click_verify import verify_click_callback
from app.core.config import Settings, get_settings


def _parse_ip_list(raw: str) -> list[ipaddress._BaseNetwork]:
    nets: list[ipaddress._BaseNetwork] = []
    for part in raw.split(","):
        token = part.strip()
        if not token:
            continue
        try:
            if "/" in token:
                nets.append(ipaddress.ip_network(token, strict=False))
            else:
                nets.append(ipaddress.ip_network(f"{token}/32", strict=False))
        except ValueError:
            continue
    return nets


def client_ip(request: Request) -> str:
    """IP manzil — nginx X-Real-IP birinchi; X-Forwarded-For faqat ishonchli proxy orqali."""
    real_ip = (request.headers.get("x-real-ip") or "").strip()
    if real_ip:
        return real_ip
    cfg = get_settings()
    if cfg.is_production:
        if request.client:
            return request.client.host
        return ""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return ""


def assert_payment_callback_ip(request: Request, settings: Settings | None = None) -> None:
    """Reject callbacks not originating from configured provider IP ranges."""
    cfg = settings or get_settings()
    if cfg.payment_sandbox_mode:
        return
    raw = (cfg.payment_callback_ip_whitelist or "").strip()
    if not raw:
        if cfg.is_production:
            raise HTTPException(status_code=403, detail="callback_ip_whitelist_required")
        return

    ip_str = client_ip(request)
    if not ip_str:
        raise HTTPException(status_code=403, detail="missing_client_ip")

    try:
        addr = ipaddress.ip_address(ip_str)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail="invalid_client_ip") from exc

    allowed = _parse_ip_list(raw)
    if not any(addr in net for net in allowed):
        raise HTTPException(status_code=403, detail="callback_ip_not_allowed")


def verify_provider_callback(provider: str, payload: dict[str, Any], settings: Settings | None = None) -> bool:
    if provider == "click":
        return verify_click_callback(payload, settings)
    return False
