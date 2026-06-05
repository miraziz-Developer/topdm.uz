from __future__ import annotations

import os

from celery import Celery
from datetime import timedelta

from celery.schedules import crontab, schedule

from app.core.config import get_settings


def _ensure_orm_registry() -> None:
    """Celery worker alohida jarayon — barcha mapperlar ro'yxatdan o'tishi kerak."""
    import app.infrastructure.db.models  # noqa: F401
    import app.models  # noqa: F401
    import app.models.topdmbozor  # noqa: F401


_ensure_orm_registry()

settings = get_settings()
broker = os.getenv("CELERY_BROKER_URL", settings.redis_url)
backend_result = os.getenv("CELERY_RESULT_BACKEND", settings.redis_url)
poll_sec = max(1800, int(settings.tdb_bts_poll_interval_seconds))

celery_app = Celery("topdmbozor", broker=broker, backend=backend_result)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Tashkent",
    enable_utc=True,
    task_track_started=True,
    beat_schedule={
        "tdb-check-bts-shipments": {
            "task": "topdmbozor.check_shipped_bts_orders",
            "schedule": schedule(run_every=timedelta(seconds=poll_sec)),
        },
        "merchant-monthly-debt-block": {
            "task": "billing.run_monthly_merchant_debt_block",
            "schedule": crontab(day_of_month=1, hour=0, minute=0),
        },
        "stories-gc-expired-weekly": {
            "task": "stories.gc_expired",
            "schedule": crontab(day_of_week=0, hour=3, minute=30),
        },
    },
)

celery_app.autodiscover_tasks(["app.infrastructure.tasks"])
