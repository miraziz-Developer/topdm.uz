#!/usr/bin/env python3
"""Run Bozor-AI merchant Telegram bot (aiogram). Requires TELEGRAM_BOT_TOKEN and database."""

from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

script_dir = Path(__file__).resolve().parent
repo_root = script_dir.parent
backend_root = repo_root / "backend"
if (backend_root / "app").is_dir():
    sys.path.insert(0, str(backend_root))
elif (repo_root / "app").is_dir():
    sys.path.insert(0, str(repo_root))

logging.basicConfig(level=logging.INFO)

from app.infrastructure.bots.merchant_aiogram_bot import run_merchant_bot_polling


def main() -> None:
    asyncio.run(run_merchant_bot_polling())


if __name__ == "__main__":
    main()
