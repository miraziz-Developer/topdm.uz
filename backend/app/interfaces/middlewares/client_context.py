from __future__ import annotations

import time

from starlette.requests import Request

from app.core.client_context import set_client_context


async def client_context_middleware(request: Request, call_next):
    locale = request.headers.get("x-bozor-locale") or request.headers.get("X-Bozor-Locale")
    currency = request.headers.get("x-bozor-currency") or request.headers.get("X-Bozor-Currency")
    set_client_context(locale=locale, currency=currency)
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    response.headers.setdefault("X-Response-Time", f"{duration_ms:.1f}ms")
    return response
