from __future__ import annotations

from typing import Any

from fastapi import BackgroundTasks
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.domain.interfaces.notifier_gateway import NotifierGateway
from app.infrastructure.db.session import AsyncSessionFactory
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway
from app.infrastructure.repositories.indoor_map_repo import IndoorMapRepository


def _format_distance_meters(distance_units: float | None) -> str:
    if distance_units is None or distance_units <= 0:
        return "yaqin"
    meters = max(1, int(round(distance_units * 0.45)))
    if meters < 1000:
        return f"{meters} m"
    return f"{meters / 1000:.1f} km"


async def notify_merchant_customer_en_route(
    session: AsyncSession,
    notifier: NotifierGateway | None,
    *,
    market_slug: str,
    level: int,
    goal_node_id: str,
    distance_units: float | None = None,
) -> None:
    if notifier is None:
        return
    repo = IndoorMapRepository(session)
    shop = await repo.find_shop_for_route_goal(market_slug, level, goal_node_id)
    if not shop or not shop.telegram_chat_id:
        logger.debug(
            "route_notify_skipped",
            market_slug=market_slug,
            goal_node_id=goal_node_id,
            reason="no_shop_telegram",
        )
        return
    shop_name = shop.name or "Do'kon"
    dist_label = _format_distance_meters(distance_units)
    text = (
        f"Mijoz sizning do'koningizga yo'l oldi ({shop_name}).\n"
        f"Taxminiy masofa: {dist_label}."
    )
    try:
        await notifier.send_message(int(shop.telegram_chat_id), text)
        from app.application.merchant.workspace_hub import MerchantWorkspaceHub

        hub = MerchantWorkspaceHub(session)
        await hub.push_alert(
            shop.id,
            {
                "type": "customer_en_route",
                "title": "Mijoz yo'lda",
                "body": f"{shop_name} — taxminiy {dist_label}",
            },
        )
        logger.info(
            "route_notify_sent",
            shop_id=str(shop.id),
            market_slug=market_slug,
            goal_node_id=goal_node_id,
            distance_label=dist_label,
        )
    except Exception:
        logger.warning(
            "route_notify_failed",
            shop_id=str(shop.id),
            market_slug=market_slug,
        )


async def _run_route_notify_job(
    *,
    market_slug: str,
    level: int,
    goal_node_id: str,
    distance_units: float | None = None,
) -> None:
    settings = get_settings()
    notifier = TelegramNotifierGateway(settings.telegram_bot_token)
    async with AsyncSessionFactory() as session:
        await notify_merchant_customer_en_route(
            session,
            notifier,
            market_slug=market_slug,
            level=level,
            goal_node_id=goal_node_id,
            distance_units=distance_units,
        )


def schedule_route_customer_notifications(
    background_tasks: BackgroundTasks,
    jobs: list[dict[str, Any]],
) -> None:
    for job in jobs:
        goal = str(job.get("goal_node_id") or "").strip()
        if not goal:
            continue
        background_tasks.add_task(
            _run_route_notify_job,
            market_slug=str(job.get("market_slug") or "ippodrom"),
            level=int(job.get("level") or 1),
            goal_node_id=goal,
            distance_units=job.get("distance_units"),
        )
