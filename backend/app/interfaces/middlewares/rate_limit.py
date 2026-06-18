"""Global API rate limit — IP va autentifikatsiyalangan foydalanuvchi."""
from __future__ import annotations

from fastapi import Request, Response
from starlette.responses import JSONResponse

from app.core.config import get_settings
from app.infrastructure.cache.redis_gateway import RedisCacheGateway

_SKIP_PREFIXES = (
    "/health",
    "/api/v1/health",
    "/api/v1/media/",
    "/docs",
    "/openapi.json",
    "/redoc",
)


def _client_ip(request: Request) -> str:
    real_ip = (request.headers.get("x-real-ip") or "").strip()
    if real_ip:
        return real_ip
    if request.client:
        return request.client.host
    return "unknown"


async def global_rate_limit_middleware(request: Request, call_next) -> Response:
    path = request.url.path
    if request.method == "OPTIONS" or any(path.startswith(p) for p in _SKIP_PREFIXES):
        return await call_next(request)

    settings = get_settings()
    cache = RedisCacheGateway()
    ip = _client_ip(request)

    ip_ok = await cache.check_fixed_window(
        f"rl:ip:{ip}",
        limit=max(60, settings.user_rate_limit_per_minute * 3),
        window_seconds=60,
    )
    if not ip_ok:
        return JSONResponse(status_code=429, content={"detail": "rate_limit_exceeded"})

    return await call_next(request)
