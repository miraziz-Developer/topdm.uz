from __future__ import annotations

from uuid import UUID

from loguru import logger
from sqlalchemy import select

from app.application.delivery.bts_delivery import BtsDeliveryService
from app.core.config import get_settings
from app.infrastructure.db.session import AsyncSessionFactory
from app.infrastructure.repositories.delivery_repo import DeliveryRepository
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.infrastructure.tasks.celery_app import celery_app
from app.models.delivery_claim import DeliveryClaimModel


@celery_app.task(name="delivery.poll_bts_claims", bind=True, max_retries=2)
def poll_bts_delivery_claims(self) -> dict:
    from app.infrastructure.tasks.async_runner import run_async_task

    try:
        return run_async_task(_poll_bts_claims_async())
    except Exception:
        logger.exception("bts_delivery_poll_failed")
        raise


async def _poll_bts_claims_async() -> dict:
    settings = get_settings()
    bts = BtsDeliveryService(settings)
    summary = {"checked": 0, "updated": 0, "delivered": 0}

    async with AsyncSessionFactory() as session:
        repo = DeliveryRepository(session)
        marketplace = MarketplaceRepository(session)
        claims = await repo.list_active_bts_claims()
        for claim in claims:
            if not claim.yandex_claim_id:
                continue
            summary["checked"] += 1
            try:
                info = await bts.get_shipment_info(claim.yandex_claim_id)
                mapped = bts.map_bts_status_to_claim(
                    status_code=str(info.get("status_code") or ""),
                    status_name=str(info.get("status_name") or ""),
                )
                if mapped == claim.status:
                    continue
                delivered = mapped == "delivered"
                row = await session.execute(
                    select(DeliveryClaimModel).where(DeliveryClaimModel.id == claim.id).with_for_update()
                )
                locked = row.scalar_one_or_none()
                if not locked:
                    continue
                await repo.update_claim_status(locked, status=mapped, delivered=delivered)
                summary["updated"] += 1
                if delivered:
                    summary["delivered"] += 1
                    from app.application.delivery.bundle_completion import complete_delivery_bundle

                    await complete_delivery_bundle(session, claim=locked)
            except Exception:
                logger.exception("bts_claim_poll_error claim_id={}", claim.id)
        await session.commit()

    logger.info("bts_delivery_poll_done {}", summary)
    return summary
