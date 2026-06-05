from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.merchant.workspace_draft import load_workspace_draft, merge_workspace_draft
from app.application.merchant.workspace_hub import MerchantWorkspaceHub
from app.core.config import get_settings
from app.infrastructure.cache.redis_gateway import RedisCacheGateway
from app.infrastructure.db.models import OrderModel, ProductModel, ShopModel
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository

logger = logging.getLogger(__name__)

PICKUP_SETTINGS_KEY = "pickup_completion_settings"
ARRIVAL_TTL_SECONDS = 4 * 60 * 60

DEFAULT_PICKUP_SETTINGS = {
    "notify_on_arrival": True,
    "auto_complete_enabled": False,
    "auto_complete_after_minutes": 20,
    "shop_arrival_radius_m": 100,
}


async def get_pickup_settings(shop_id: UUID) -> dict[str, Any]:
    draft = await load_workspace_draft(shop_id)
    raw = draft.get(PICKUP_SETTINGS_KEY)
    if not isinstance(raw, dict):
        raw = {}
    merged = {**DEFAULT_PICKUP_SETTINGS, **raw}
    merged["auto_complete_after_minutes"] = max(5, min(int(merged["auto_complete_after_minutes"]), 120))
    merged["shop_arrival_radius_m"] = max(40, min(int(merged["shop_arrival_radius_m"]), 300))
    return merged


async def set_pickup_settings(shop_id: UUID, payload: dict[str, Any]) -> dict[str, Any]:
    current = await get_pickup_settings(shop_id)
    for key in DEFAULT_PICKUP_SETTINGS:
        if key in payload and payload[key] is not None:
            current[key] = payload[key]
    await merge_workspace_draft(shop_id, {PICKUP_SETTINGS_KEY: current})
    return current


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


class OrderPickupCompletionService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._cache = RedisCacheGateway()
        self._repo = MarketplaceRepository(session)
        self._settings = get_settings()

    async def process_location_ping(
        self,
        order: OrderModel,
        shop: ShopModel,
        product: ProductModel | None,
        *,
        distance_m: float,
        inside_market: bool,
        approach_payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Detect shop arrival from coarse location; notify merchant and optional auto-complete."""
        status = (order.status or "").lower()
        if status in {"completed", "cancelled"}:
            return {"arrival_detected": False, "order_status": status}

        pickup_settings = await get_pickup_settings(shop.id)
        radius_m = float(pickup_settings["shop_arrival_radius_m"])
        at_shop = inside_market and distance_m <= radius_m

        if not at_shop:
            return {
                "arrival_detected": False,
                "customer_message": None,
                "pickup_hint": None,
            }

        now = datetime.now(timezone.utc)
        arrival_key = f"arrival:order:{order.id}"
        state = await self._cache.get(arrival_key) or {}
        first_seen = _parse_iso(state.get("first_seen_at")) or now
        if not state.get("first_seen_at"):
            state["first_seen_at"] = first_seen.isoformat()

        dwell_min = (now - first_seen).total_seconds() / 60.0
        state.update(
            {
                "order_id": str(order.id),
                "shop_id": str(shop.id),
                "last_seen_at": now.isoformat(),
                "dwell_minutes": round(dwell_min, 1),
            }
        )
        await self._cache.set(arrival_key, state, ttl_seconds=ARRIVAL_TTL_SECONDS)

        approach_payload["arrival_status"] = "at_shop"
        approach_payload["arrived_at"] = state["first_seen_at"]
        approach_payload["dwell_minutes"] = state["dwell_minutes"]
        await self._cache.set(
            f"approach:order:{order.id}",
            approach_payload,
            ttl_seconds=ARRIVAL_TTL_SECONDS,
        )

        customer_message = "Siz do'konga yetdingiz! Mahsulotni olib keting."
        result: dict[str, Any] = {
            "arrival_detected": True,
            "arrival_status": "at_shop",
            "dwell_minutes": round(dwell_min, 1),
            "customer_message": customer_message,
            "pickup_hint": "Sotuvchi tez orada tasdiqlaydi",
        }

        if pickup_settings["notify_on_arrival"] and not state.get("merchant_notified"):
            await self._notify_merchant_arrival(shop, order, product, dwell_min)
            state["merchant_notified"] = True
            await self._cache.set(arrival_key, state, ttl_seconds=ARRIVAL_TTL_SECONDS)

        auto_after = int(pickup_settings["auto_complete_after_minutes"])
        if pickup_settings["auto_complete_enabled"] and dwell_min >= auto_after and status != "completed":
            completed = await self._complete_order(shop.id, order.id, source="auto_arrival")
            if completed:
                result["auto_completed"] = True
                result["order_status"] = "completed"
                result["customer_message"] = "Rahmat! Olib ketilgan deb belgilandi."
                result["pickup_hint"] = None
                await self._clear_tracking(order.id, shop.id)
                return result

        if dwell_min >= 3 and not state.get("reminder_sent"):
            await self._notify_merchant_pickup_reminder(shop, order, product, dwell_min)
            state["reminder_sent"] = True
            await self._cache.set(arrival_key, state, ttl_seconds=ARRIVAL_TTL_SECONDS)
            result["merchant_reminder"] = True

        return result

    async def confirm_pickup_manual(
        self,
        shop_id: UUID,
        order_id: UUID,
        *,
        note: str | None = None,
    ) -> dict[str, Any]:
        order = await self._repo.update_order_status(
            shop_id=shop_id,
            order_id=order_id,
            status="completed",
        )
        if not order:
            raise ValueError("order_not_found")
        await self._accrue_offline_pickup_debt(order.id)
        await self._clear_tracking(order_id, shop_id)
        hub = MerchantWorkspaceHub(self._session)
        await hub.push_alert(
            shop_id,
            {
                "type": "pickup_confirmed",
                "title": "Olib ketildi",
                "body": note or "Buyurtma qo'lda yakunlandi",
            },
        )
        return {
            "order_id": str(order.id),
            "status": order.status,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "source": "manual",
        }

    async def get_arrival_meta(self, order_id: UUID) -> dict[str, Any] | None:
        raw = await self._cache.get(f"arrival:order:{order_id}")
        return raw if isinstance(raw, dict) else None

    async def _complete_order(self, shop_id: UUID, order_id: UUID, *, source: str) -> bool:
        order = await self._repo.update_order_status(
            shop_id=shop_id,
            order_id=order_id,
            status="completed",
        )
        if not order:
            return False
        await self._accrue_offline_pickup_debt(order.id)
        hub = MerchantWorkspaceHub(self._session)
        await hub.push_alert(
            shop_id,
            {
                "type": "pickup_auto_completed",
                "title": "Avtomatik yakunlandi",
                "body": f"Buyurtma {source} — mijoz do'konda bo'lgan",
            },
        )
        return True

    async def _accrue_offline_pickup_debt(self, order_id: UUID) -> None:
        from app.application.billing.merchant_debt_service import MerchantDebtService

        try:
            await MerchantDebtService(self._session).process_cash_pickup_completion(order_id)
        except Exception:
            logger.exception("merchant_debt_accrual_failed order_id=%s", order_id)

    async def _clear_tracking(self, order_id: UUID, shop_id: UUID) -> None:
        await self._cache.delete(f"approach:order:{order_id}")
        await self._cache.delete(f"arrival:order:{order_id}")
        shop_raw = await self._cache.get(f"approach:shop:{shop_id}")
        if isinstance(shop_raw, dict):
            ids = [x for x in shop_raw.get("order_ids", []) if str(x) != str(order_id)]
            await self._cache.set(
                f"approach:shop:{shop_id}",
                {"order_ids": ids},
                ttl_seconds=ARRIVAL_TTL_SECONDS,
            )

    async def _notify_merchant_arrival(
        self,
        shop: ShopModel,
        order: OrderModel,
        product: ProductModel | None,
        dwell_min: float,
    ) -> None:
        name = product.name if product else "mahsulot"
        hub = MerchantWorkspaceHub(self._session)
        await hub.push_alert(
            shop.id,
            {
                "type": "customer_at_shop",
                "title": "Mijoz do'konda",
                "body": f"{name} — bron mijoz yetib keldi",
            },
        )
        if shop.telegram_chat_id and self._settings.telegram_bot_token:
            notifier = TelegramNotifierGateway(self._settings.telegram_bot_token)
            text = (
                f"Mijoz do'koningizda!\n"
                f"Mahsulot: {name}\n"
                f"Bron holati: {order.status}\n\n"
                f"Olib ketilgan bo'lsa CRMda «Olib ketdi» bosing."
            )
            try:
                from app.application.merchant.telegram_crm_notify import notify_merchant_telegram

                await notify_merchant_telegram(
                    notifier,
                    chat_id=int(shop.telegram_chat_id),
                    text=text,
                    shop_id=shop.id,
                    crm_next="/dashboard/sales",
                )
            except Exception:
                pass

    async def _notify_merchant_pickup_reminder(
        self,
        shop: ShopModel,
        order: OrderModel,
        product: ProductModel | None,
        dwell_min: float,
    ) -> None:
        name = product.name if product else "mahsulot"
        hub = MerchantWorkspaceHub(self._session)
        await hub.push_alert(
            shop.id,
            {
                "type": "pickup_reminder",
                "title": "Tasdiqlash kerak",
                "body": f"{name} — {int(dwell_min)} daq bo'ldi, olib ketildimi?",
            },
        )
