from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.bootstrap import validate_settings
from app.core.sentry_init import init_sentry
from app.core.config import get_settings
from app.core.logging_config import configure_logging
from app.infrastructure.db.session import AsyncSessionFactory
from app.interfaces.api.routes import router as api_router
from app.interfaces.api.billing_routes import router as billing_router
from app.interfaces.api.billing_routes import vendors_router
from app.interfaces.api.reels_routes import router as reels_router
from app.interfaces.middlewares.exception_handlers import (
    database_exception_handler,
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.interfaces.middlewares.client_context import client_context_middleware
from app.interfaces.middlewares.rate_limit import global_rate_limit_middleware
from app.interfaces.middlewares.request_id import request_id_middleware
from app.application.crm_banners.expiration import banner_expiration_worker, expire_sponsored_banners
from app.interfaces.ws.chat_ws import router as ws_router

configure_logging()
settings = get_settings()
validate_settings(settings)


def _init_sentry() -> None:
    init_sentry(settings=settings)


_init_sentry()

_openapi = "/openapi.json" if settings.app_debug else None
_docs = "/docs" if settings.app_debug else None
_redoc = "/redoc" if settings.app_debug else None


@asynccontextmanager
async def _app_lifespan(_app: FastAPI):
    stop = asyncio.Event()
    worker = asyncio.create_task(banner_expiration_worker(stop))
    try:
        await expire_sponsored_banners()
    except Exception:
        pass
    try:
        from app.infrastructure.ai_clients.clip_visual_embed import warmup_clip_model

        await warmup_clip_model()
    except Exception:
        pass
    if (settings.fashion_detect_backend or "yolos").lower() == "yolos":
        try:
            from app.infrastructure.ai_clients.yolos_fashion_detect import warmup_yolos_fashion

            await warmup_yolos_fashion()
        except Exception:
            pass
    yield
    stop.set()
    worker.cancel()
    try:
        await worker
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=f"{settings.app_name} Backend",
    debug=settings.app_debug,
    docs_url=_docs,
    redoc_url=_redoc,
    openapi_url=_openapi,
    lifespan=_app_lifespan,
)

app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(SQLAlchemyError, database_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

_cors_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
_cors_headers = [
    "Authorization",
    "Content-Type",
    "X-Request-ID",
    "X-Admin-Key",
    "X-Bozor-Locale",
    "X-Bozor-Currency",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=_cors_methods if settings.is_production else ["*"],
    allow_headers=_cors_headers if settings.is_production else ["*"],
)

app.middleware("http")(client_context_middleware)
app.middleware("http")(request_id_middleware)
app.middleware("http")(global_rate_limit_middleware)


@app.middleware("http")
async def _security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    if settings.is_production:
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
        )
    return response


app.include_router(api_router, prefix=settings.api_prefix)
app.include_router(billing_router, prefix=settings.api_prefix)
app.include_router(vendors_router, prefix=settings.api_prefix)
app.include_router(reels_router, prefix=settings.api_prefix)
app.include_router(ws_router)

# SQLAdmin web panel (faqat platforma egasi uchun — /admin)
try:
    from app.interfaces.admin_panel import setup_admin_panel

    setup_admin_panel(app, settings)
except Exception as exc:  # noqa: BLE001
    from loguru import logger

    logger.warning("Admin panel ulanmadi: {}", exc)


async def _health_payload(*, probe_ai: bool) -> tuple[dict, int]:
    db_ok = False
    redis_ok = False
    errors: list[str] = []

    try:
        async with AsyncSessionFactory() as session:
            await session.execute(text("SELECT 1"))
        db_ok = True
    except Exception as exc:
        errors.append(f"db:{type(exc).__name__}")

    try:
        redis = Redis.from_url(settings.redis_url, decode_responses=True)
        try:
            redis_ok = bool(await redis.ping())
        finally:
            await redis.close()
    except Exception as exc:
        errors.append(f"redis:{type(exc).__name__}")

    text_ai_ok = False
    vision_ai_ok = False
    if probe_ai:
        if settings.anthropic_api_key:
            text_ai_ok = True
        elif settings.groq_api_key:
            try:
                from app.ai.config import iter_groq_api_keys

                groq_ok = False
                async with httpx.AsyncClient(timeout=5) as client:
                    for key in iter_groq_api_keys(settings):
                        resp = await client.get(
                            "https://api.groq.com/openai/v1/models",
                            headers={"Authorization": f"Bearer {key}"},
                        )
                        if resp.status_code == 200:
                            groq_ok = True
                            break
                        if resp.status_code in {401, 403}:
                            errors.append("groq:invalid_api_key")
                text_ai_ok = groq_ok
                if not groq_ok and "groq:invalid_api_key" not in errors:
                    errors.append("groq:unreachable")
            except Exception as exc:
                errors.append(f"groq:{type(exc).__name__}")
        else:
            errors.append("groq:missing_keys")

        if settings.google_api_key:
            try:
                async with httpx.AsyncClient(timeout=3) as client:
                    gem = await client.get("https://generativelanguage.googleapis.com")
                    if gem.status_code < 500:
                        vision_ai_ok = True
            except Exception as exc:
                errors.append(f"gemini:{type(exc).__name__}")
        else:
            vision_ai_ok = bool(settings.groq_api_key)

    critical_ok = db_ok and redis_ok
    ai_ok = (text_ai_ok and vision_ai_ok) if probe_ai else True
    overall_ok = critical_ok and ai_ok

    status = "ok" if overall_ok else "degraded"
    status_code = 200 if critical_ok else 503

    payload = {
        "status": status,
        "service": settings.app_name,
        "env": settings.app_env,
        "checks": {
            "database": "ok" if db_ok else "fail",
            "redis": "ok" if redis_ok else "fail",
            "ai_connectivity": "ok" if ai_ok else ("skip" if not probe_ai else "fail"),
            "text_ai_groq": "ok" if text_ai_ok else ("skip" if not probe_ai else "fail"),
            "text_ai_anthropic": "ok" if settings.anthropic_api_key else "skip",
            "embedding_openai": "ok" if settings.openai_api_key else "fallback",
            "vision_ai": "ok" if vision_ai_ok else ("skip" if not probe_ai else "fail"),
        },
        "errors": errors,
    }
    return payload, status_code


@app.get("/health", tags=["health"])
@app.get(f"{settings.api_prefix}/health", tags=["health"])
async def health() -> JSONResponse:
    """Liveness/readiness: DB + Redis required; AI probed in production readiness."""
    probe_ai = settings.is_production or (settings.app_debug and not settings.is_production)
    payload, status_code = await _health_payload(probe_ai=probe_ai)
    return JSONResponse(content=payload, status_code=status_code)


@app.get(f"{settings.api_prefix}/health/live", tags=["health"])
async def health_live() -> JSONResponse:
    payload, status_code = await _health_payload(probe_ai=False)
    return JSONResponse(content=payload, status_code=status_code)
