from __future__ import annotations

import sys

from loguru import logger

from app.core.config import get_settings


def configure_logging() -> None:
    settings = get_settings()
    logger.remove()
    level = "DEBUG" if settings.app_debug else "INFO"
    logger.add(
        sys.stderr,
        level=level,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan> — <level>{message}</level>",
        enqueue=True,
        backtrace=settings.app_debug,
        diagnose=settings.app_debug,
    )
