from celery import Celery

celery_app = Celery(
    "bozor_ai_engine",
    broker="redis://localhost:6379/1",
    backend="redis://localhost:6379/2",
)
