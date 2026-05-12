from fastapi import FastAPI
import asyncio

import httpx
from sqlalchemy import text

from app.core.config import get_settings
from app.infrastructure.db.session import AsyncSessionFactory
from app.interfaces.api.routes import router as api_router
from app.interfaces.middlewares.request_id import request_id_middleware
from redis.asyncio import Redis

settings = get_settings()

app = FastAPI(
    title=f"{settings.app_name} Backend",
    debug=settings.app_debug,
)

app.middleware("http")(request_id_middleware)
app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/health")
async def health() -> dict:
    db_ok = False
    redis_ok = False
    ai_ok = False
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
    if settings.groq_api_key:
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                groq = client.get("https://api.groq.com/openai/v1/models")
                await asyncio.gather(groq)
            text_ai_ok = True
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
        # fallback: vision can still run via Groq vision model
        vision_ai_ok = bool(settings.groq_api_key)

    ai_ok = text_ai_ok and vision_ai_ok

    status = "ok" if db_ok and redis_ok and ai_ok else "degraded"
    return {
        "status": status,
        "service": settings.app_name,
        "checks": {
            "database": "ok" if db_ok else "fail",
            "redis": "ok" if redis_ok else "fail",
            "ai_connectivity": "ok" if ai_ok else "fail",
            "text_ai_groq": "ok" if text_ai_ok else "fail",
            "vision_ai": "ok" if vision_ai_ok else "fail",
        },
        "errors": errors,
    }
