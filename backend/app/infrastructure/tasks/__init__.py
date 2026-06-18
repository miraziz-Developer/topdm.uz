"""Celery tasks — import modullar worker startida yuklanadi."""

from app.infrastructure.tasks import debt_cron_tasks as debt_cron_tasks  # noqa: F401
from app.infrastructure.tasks import delivery_tasks as delivery_tasks  # noqa: F401
from app.infrastructure.tasks import order_expiry_tasks as order_expiry_tasks  # noqa: F401
from app.infrastructure.tasks import reembed_tasks as reembed_tasks  # noqa: F401
from app.infrastructure.tasks import stories_tasks as stories_tasks  # noqa: F401
