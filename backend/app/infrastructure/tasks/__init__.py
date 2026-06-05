"""Celery tasks — import modullar worker startida yuklanadi."""

from app.infrastructure.tasks import debt_cron_tasks as debt_cron_tasks  # noqa: F401
from app.infrastructure.tasks import stories_tasks as stories_tasks  # noqa: F401
from app.infrastructure.tasks import topdmbozor_tasks as topdmbozor_tasks  # noqa: F401
