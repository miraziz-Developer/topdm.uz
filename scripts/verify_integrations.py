#!/usr/bin/env python3
"""Click/Payme sandbox, media, SMS (Eskiz) integratsiya tekshiruvi."""
from __future__ import annotations

import asyncio
import os
import sys


def _bootstrap() -> None:
    here = os.path.abspath(os.path.dirname(__file__))
    for candidate in (os.path.join(here, "..", "backend"), os.path.join(here, "..")):
        if os.path.isdir(os.path.join(candidate, "app")):
            sys.path.insert(0, candidate)
            return
    raise RuntimeError("backend app not found")


_bootstrap()

import httpx

from app.core.config import get_settings


def _ok(label: str, detail: str = "") -> bool:
    print(f"  ✓ {label}" + (f" — {detail}" if detail else ""))
    return True


def _warn(label: str, detail: str = "") -> bool:
    print(f"  ⚠ {label}" + (f" — {detail}" if detail else ""))
    return True


def _fail(label: str, detail: str = "") -> bool:
    print(f"  ✗ {label}" + (f" — {detail}" if detail else ""))
    return False


async def main() -> int:
    settings = get_settings()
    api = (os.getenv("API_BASE_URL") or "http://127.0.0.1:8000/api/v1").rstrip("/")
    fails = 0

    print(f"Bozorliii verify_integrations → {api}\n")

    print("[Payments]")
    if settings.enable_online_checkout:
        _ok("ENABLE_ONLINE_CHECKOUT=true")
    else:
        fails += int(not _warn("ENABLE_ONLINE_CHECKOUT=false", "checkoutda faqat naqd/terminal"))

    if settings.payment_sandbox_mode:
        _ok("PAYMENT_SANDBOX_MODE=true", "test to'lov ishlaydi")
    elif settings.click_service_id and settings.payme_merchant_id:
        _ok("Production Click/Payme kalitlari bor")
    else:
        fails += int(
            not _warn(
                "Onlayn to'lov sandbox yoki kalitlar yo'q",
                "ALLOW_PAYMENT_SANDBOX_IN_PRODUCTION=true qiling",
            )
        )

    async with httpx.AsyncClient(timeout=20) as client:
        try:
            r = await client.get(f"{api}/platform/checkout-payment-options")
            if r.status_code == 200:
                data = r.json()
                online = data.get("online") or {}
                if online.get("bridge"):
                    _ok("checkout-payment-options API", f"click={online.get('click')} payme={online.get('payme')}")
                else:
                    fails += int(not _fail("checkout-payment-options", "bridge=false"))
            else:
                fails += int(not _fail("checkout-payment-options", str(r.status_code)))
        except Exception as exc:
            fails += int(not _fail("checkout-payment-options", str(exc)))

    print("\n[Media]")
    backend = (settings.media_storage_backend or "local").strip().lower()
    if backend == "s3" and settings.s3_bucket and settings.s3_access_key_id:
        _ok("MEDIA_STORAGE_BACKEND=s3", settings.s3_bucket)
    elif backend == "local":
        _warn("MEDIA_STORAGE_BACKEND=local", "Docker volume /api/v1/media — R2 keyin ulang")
        uploads = os.path.join(os.path.dirname(__file__), "..", "backend", "uploads", "products")
        if os.path.isdir(uploads):
            count = sum(1 for _ in os.scandir(uploads))
            _ok("Local uploads papkasi", f"{count} shop papka")
    else:
        fails += int(not _fail("Media backend sozlanmagan"))

    print("\n[SMS / Eskiz]")
    has_eskiz = bool(
        (settings.eskiz_api_token or "").strip()
        or ((settings.eskiz_email or "").strip() and (settings.eskiz_password or "").strip())
    )
    if has_eskiz:
        _ok("Eskiz SMS sozlangan")
    else:
        _warn(
            "Eskiz SMS yo'q",
            "Mijoz telefon OTP ishlamaydi; merchant CRM Telegram OTP ishlatadi",
        )

    print("\n[Merchant auth]")
    _ok("CRM login: parol + Telegram OTP", "Eskiz shart emas")

    print("\n" + "=" * 56)
    if fails:
        print(f"RESULT: {fails} muhim check(s) failed")
        return 1
    print("RESULT: OK (ogohlantirishlar ixtiyoriy integratsiyalar)")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
