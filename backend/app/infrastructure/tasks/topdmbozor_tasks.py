from __future__ import annotations

import asyncio

import app.infrastructure.db.models  # noqa: F401 — ORM registry for Celery
import app.models  # noqa: F401
import app.models.topdmbozor  # noqa: F401

from loguru import logger

from app.application.topdmbozor.split_payout_service import SplitPayoutService
from app.infrastructure.db.session import AsyncSessionFactory
from app.infrastructure.repositories.topdmbozor_repo import TopdmbozorRepository
from app.infrastructure.tasks.celery_app import celery_app
from app.infrastructure.topdmbozor.bts_client import BtsTrackingClient


@celery_app.task(name="topdmbozor.check_shipped_bts_orders", bind=True, max_retries=2)
def check_shipped_bts_orders(self) -> dict:
    """Celery sync wrapper — har 30–60 daqiqada BTS status tekshiruvi."""
    try:
        return asyncio.run(_check_shipped_async())
    except Exception as exc:
        logger.exception("tdb_celery_bts_check_failed")
        raise self.retry(exc=exc, countdown=120) from exc


async def _check_shipped_async() -> dict:
    bts = BtsTrackingClient()
    checked = 0
    delivered = 0
    errors = 0

    async with AsyncSessionFactory() as session:
        repo = TopdmbozorRepository(session)
        orders = await repo.list_shipped_orders()
        payout = SplitPayoutService(session)

        for order in orders:
            if not order.tracking_number:
                continue
            checked += 1
            try:
                result = await bts.track(order.tracking_number)
                status = str(result.get("status", "")).lower()
                if status not in ("delivered", "completed", "done"):
                    continue
                ok = await payout.complete_delivered_order(order.id)
                if ok:
                    delivered += 1
            except Exception:
                errors += 1
                logger.exception("tdb_bts_order_check_failed order_id={}", order.id)

    summary = {"checked": checked, "delivered": delivered, "errors": errors}
    logger.info("tdb_bts_poll_done {}", summary)
    return summary


@celery_app.task(name="topdmbozor.poll_single_order", bind=True)
def poll_single_order_tracking(self, order_id: str) -> dict:
    """Ship endpoint dan keyin bitta buyurtmani tekshirish."""
    return asyncio.run(_poll_one(order_id))


async def _poll_one(order_id: str) -> dict:
    from uuid import UUID

    oid = UUID(order_id)
    async with AsyncSessionFactory() as session:
        repo = TopdmbozorRepository(session)
        order = await repo.get_order(oid)
        if not order or not order.tracking_number:
            return {"ok": False, "detail": "not_found"}
        bts = BtsTrackingClient()
        result = await bts.track(order.tracking_number)
        status = str(result.get("status", "")).lower()
        if status in ("delivered", "completed", "done"):
            ok = await SplitPayoutService(session).complete_delivered_order(oid)
            return {"ok": ok, "status": status, "completed": ok}
        return {"ok": True, "status": status, "completed": False}
