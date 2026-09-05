#!/usr/bin/env python3
"""Container health probe for Telegram, PostgreSQL and Redis dependencies."""

from __future__ import annotations

import asyncio

from aiogram import Bot
from redis.asyncio import Redis
from sqlalchemy import text

from app.core.config import get_settings
from app.infrastructure.db.session import AsyncSessionFactory


async def main() -> None:
    settings = get_settings()
    token = settings.telegram_bot_token.strip()
    if not token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is missing")

    async with AsyncSessionFactory() as session:
        await session.execute(text("SELECT 1"))

    redis = Redis.from_url(settings.redis_url)
    try:
        if not await redis.ping():
            raise RuntimeError("Redis ping failed")
    finally:
        await redis.aclose()

    bot = Bot(token=token)
    try:
        identity = await bot.get_me()
        if not identity.id:
            raise RuntimeError("Telegram getMe returned no bot id")
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())