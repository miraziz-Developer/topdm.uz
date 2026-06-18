from __future__ import annotations

import asyncio

import app.infrastructure.db.models  # noqa: F401
import app.models  # noqa: F401

from loguru import logger

from app.application.billing.merchant_debt_service import monthly_merchant_debt_block_task
from app.infrastructure.tasks.async_runner import run_async_task
from app.infrastructure.tasks.celery_app import celery_app


@celery_app.task(name="billing.run_monthly_merchant_debt_block", bind=True, max_retries=1)
def run_monthly_merchant_debt_block(self) -> dict:
    """Har oyning 1-sanasida qarzi bor do'konlarni bloklash."""
    try:
        return run_async_task(monthly_merchant_debt_block_task())
    except Exception as exc:
        logger.exception("merchant_monthly_debt_block_failed")
        raise self.retry(exc=exc, countdown=300) from exc
