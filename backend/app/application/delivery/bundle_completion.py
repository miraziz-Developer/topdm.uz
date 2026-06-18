"""Yetkazish bundle — barcha qator buyurtmalarni completed qilish."""
from __future__ import annotations

from uuid import UUID

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.marketplace.use_cases import MarketplaceUseCases
from app.core.config import get_settings
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.models.delivery_claim import DeliveryClaimModel


def bundle_order_ids(claim: DeliveryClaimModel) -> list[UUID]:
    meta = claim.meta or {}
    lines = meta.get("bundle_lines") or []
    ids: list[UUID] = []
    if isinstance(lines, list):
        for row in lines:
            if isinstance(row, dict) and row.get("order_id"):
                try:
                    ids.append(UUID(str(row["order_id"])))
                except ValueError:
                    continue
    if claim.order_id not in ids:
        ids.insert(0, claim.order_id)
    return ids


async def complete_delivery_bundle(
    session: AsyncSession,
    *,
    claim: DeliveryClaimModel,
) -> list[str]:
    """BTS yetkazilganda bundle ichidagi barcha buyurtmalarni completed qiladi."""
    marketplace = MarketplaceRepository(session)
    use_cases = MarketplaceUseCases(
        repo=marketplace,
        notifier=TelegramNotifierGateway(get_settings().telegram_bot_token),
    )
    completed: list[str] = []
    for oid in bundle_order_ids(claim):
        order = await marketplace.get_order_by_id(oid)
        if not order or order.shop_id != claim.shop_id:
            continue
        if order.status == "completed":
            completed.append(str(oid))
            continue
        if order.status == "cancelled":
            continue
        try:
            await use_cases.update_order_status(
                shop_id=claim.shop_id,
                order_id=oid,
                status="completed",
            )
            completed.append(str(oid))
        except Exception:
            logger.exception("bundle_order_complete_failed order_id={}", oid)
    return completed
