"""Imzolangan olib-ketish QR tokenlari — mijoz ko'rsatadi, sotuvchi skaner qiladi."""

from __future__ import annotations

import hashlib
import hmac
import re
import time
from urllib.parse import quote
from uuid import UUID

from app.core.config import Settings, get_settings

PICKUP_QR_PREFIX = "BLZ1"
_UUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
TOKEN_RE = re.compile(
    rf"^{PICKUP_QR_PREFIX}\.({_UUID})\.({_UUID})\.(\d{{10}})\.([0-9a-f]{{20}})$",
    re.IGNORECASE,
)

CUSTOMER_QR_VISIBLE_STATUSES = frozenset({"pending", "reserved", "confirmed", "preparing", "ready"})
QR_SCAN_ALLOWED_STATUSES = frozenset({"reserved", "confirmed", "preparing", "ready"})


def _signing_secret(settings: Settings | None = None) -> str:
    cfg = settings or get_settings()
    return (cfg.jwt_secret or "change-me").strip()


def _compute_sig(order_id: UUID, shop_id: UUID, exp: int, *, settings: Settings | None = None) -> str:
    payload = f"{order_id}:{shop_id}:{exp}"
    return hmac.new(
        _signing_secret(settings).encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()[:20]


def issue_pickup_qr_token(
    order_id: UUID,
    shop_id: UUID,
    *,
    ttl_hours: int = 72,
    settings: Settings | None = None,
) -> tuple[str, int]:
    exp = int(time.time()) + max(1, ttl_hours) * 3600
    sig = _compute_sig(order_id, shop_id, exp, settings=settings)
    token = f"{PICKUP_QR_PREFIX}.{order_id}.{shop_id}.{exp}.{sig}"
    return token, exp


def normalize_scanned_payload(raw: str) -> str:
    text = (raw or "").strip()
    if not text:
        return ""
    upper = text.upper()
    if "BLZ1." in upper:
        idx = upper.find("BLZ1.")
        chunk = text[idx:].split()[0].strip().rstrip(".,;)")
        return chunk
    return text


def verify_pickup_qr_token(token: str, *, settings: Settings | None = None) -> tuple[UUID, UUID]:
    normalized = normalize_scanned_payload(token)
    match = TOKEN_RE.match(normalized)
    if not match:
        raise ValueError("invalid_qr_token")
    order_id = UUID(match.group(1))
    shop_id = UUID(match.group(2))
    exp = int(match.group(3))
    sig = match.group(4).lower()
    if exp < int(time.time()):
        raise ValueError("qr_token_expired")
    expected = _compute_sig(order_id, shop_id, exp, settings=settings)
    if not hmac.compare_digest(sig, expected):
        raise ValueError("invalid_qr_token")
    return order_id, shop_id


def build_pickup_qr_image_url(token: str, *, size: int = 420) -> str:
    encoded = quote(token, safe="")
    caption = quote("Olib ketish QR", safe="")
    return (
        f"https://quickchart.io/qr?ecLevel=H&margin=2&size={size}"
        f"&dark=1a1a2e&light=ffffff&captionFontSize=16&caption={caption}&text={encoded}"
    )


def is_pickup_fulfillment(fulfillment_type: str | None) -> bool:
    return (fulfillment_type or "pickup").lower() != "delivery"
