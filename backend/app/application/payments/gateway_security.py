from __future__ import annotations

import hashlib
import hmac
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
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return ""


def assert_payment_callback_ip(request: Request, settings: Settings | None = None) -> None:
    """Reject callbacks not originating from configured provider IP ranges."""
    cfg = settings or get_settings()
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


def verify_payme_callback(payload: dict[str, Any], settings: Settings | None = None) -> bool:
    cfg = settings or get_settings()
    secret = (cfg.payme_secret_key or "").strip()
    signature = str(payload.get("sign") or payload.get("signature") or "")
    if not secret:
        return cfg.app_debug and not cfg.is_production
    body = str(payload.get("merchant_trans_id", "")) + str(payload.get("amount", "")) + secret
    digest = hashlib.sha256(body.encode("utf-8")).hexdigest()
    return hmac.compare_digest(digest, signature)


def verify_provider_callback(provider: str, payload: dict[str, Any], settings: Settings | None = None) -> bool:
    if provider == "click":
        return verify_click_callback(payload, settings)
    if provider == "payme":
        return verify_payme_callback(payload, settings)
    return False
