from __future__ import annotations

from fastapi import HTTPException, Request

from app.infrastructure.cache.redis_gateway import RedisCacheGateway


def _client_ip(request: Request) -> str:
    real_ip = (request.headers.get("x-real-ip") or "").strip()
    if real_ip:
        return real_ip
    if request.client:
        return request.client.host
    return "unknown"


async def guard_otp_send(request: Request, *, scope: str, identity: str, limit: int = 3, window: int = 600) -> None:
    ip = _client_ip(request)
    cache = RedisCacheGateway()
    keys = (
        f"otp:send:{scope}:{identity}",
        f"otp:send:ip:{scope}:{ip}",
    )
    for key in keys:
        allowed = await cache.check_fixed_window(key, limit=limit, window_seconds=window)
        if not allowed:
            raise HTTPException(status_code=429, detail="Juda ko'p so'rov. Keyinroq urinib ko'ring.")


async def guard_otp_verify(request: Request, *, scope: str, identity: str) -> None:
    ip = _client_ip(request)
    cache = RedisCacheGateway()
    lock_key = f"otp:lock:{scope}:{identity}"
    if await cache.get(lock_key):
        raise HTTPException(status_code=429, detail="Ko'p noto'g'ri urinish. 15 daqiqa kuting.")

    burst_key = f"otp:verify:{scope}:{identity}:{ip}"
    allowed = await cache.check_fixed_window(burst_key, limit=12, window_seconds=300)
    if not allowed:
        raise HTTPException(status_code=429, detail="Juda ko'p urinish. Keyinroq qayta urinib ko'ring.")


async def record_otp_verify_failure(*, scope: str, identity: str) -> None:
    cache = RedisCacheGateway()
    fail_key = f"otp:fail:{scope}:{identity}"
    still_ok = await cache.check_fixed_window(fail_key, limit=5, window_seconds=900)
    if not still_ok:
        await cache.set(f"otp:lock:{scope}:{identity}", {"locked": True}, ttl_seconds=900)


async def clear_otp_verify_failures(*, scope: str, identity: str) -> None:
    cache = RedisCacheGateway()
    await cache.delete(f"otp:fail:{scope}:{identity}")
    await cache.delete(f"otp:lock:{scope}:{identity}")
