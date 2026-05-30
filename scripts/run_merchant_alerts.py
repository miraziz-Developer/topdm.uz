#!/usr/bin/env python3
"""One-shot merchant smart alerts (cron-friendly)."""

from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "backend"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

logging.basicConfig(level=logging.INFO)

from app.application.merchant.smart_alerts import run_merchant_smart_alerts
from app.core.config import get_settings
from app.infrastructure.db.session import AsyncSessionFactory
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway


async def main() -> None:
    settings = get_settings()
    if not settings.telegram_bot_token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN required")
    async with AsyncSessionFactory() as session:
        notifier = TelegramNotifierGateway(settings.telegram_bot_token)
        sent = await run_merchant_smart_alerts(session, notifier)
        print(f"Sent {sent} alert(s)")


if __name__ == "__main__":
    asyncio.run(main())
