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

from app.application.merchant.pickup_qr import QR_SCAN_ALLOWED_STATUSES

MANUAL_PICKUP_ALLOWED_STATUSES = frozenset()
QR_PICKUP_ALLOWED_STATUSES = QR_SCAN_ALLOWED_STATUSES

_PAYMENT_LABELS = {
    "cash": "Naqd",
    "card": "Terminal",
    "click": "Click",
    "payme": "Payme",
    "online": "Onlayn",
}

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
    merged["auto_complete_enabled"] = False
    merged["auto_complete_after_minutes"] = max(5, min(int(merged["auto_complete_after_minutes"]), 120))
    merged["shop_arrival_radius_m"] = max(40, min(int(merged["shop_arrival_radius_m"]), 300))
    return merged


async def set_pickup_settings(shop_id: UUID, payload: dict[str, Any]) -> dict[str, Any]:
    current = await get_pickup_settings(shop_id)
    for key in DEFAULT_PICKUP_SETTINGS:
        if key in payload and payload[key] is not None:
            current[key] = payload[key]
    current["auto_complete_enabled"] = False
    await merge_workspace_draft(shop_id, {PICKUP_SETTINGS_KEY: current})
    return current


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _format_phone_label(phone: str) -> str:
    digits = "".join(ch for ch in (phone or "") if ch.isdigit())
    if digits.startswith("998") and len(digits) == 12:
        return f"+998 {digits[3:5]} {digits[5:8]} {digits[8:10]} {digits[10:12]}"
    if len(digits) == 9:
        return f"+998 {digits[0:2]} {digits[2:5]} {digits[5:7]} {digits[7:9]}"
    return (phone or "").strip() or "Mijoz"


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

        if dwell_min >= 3 and not state.get("reminder_sent"):
            await self._notify_merchant_pickup_reminder(shop, order, product, dwell_min)
            state["reminder_sent"] = True
            await self._cache.set(arrival_key, state, ttl_seconds=ARRIVAL_TTL_SECONDS)
            result["merchant_reminder"] = True

        return result

    async def scan_and_complete_pickup(self, shop_id: UUID, token: str) -> dict[str, Any]:
        """QR skaner — buyurtma tafsilotlari + avtomatik yakunlash."""
        from sqlalchemy import select

        from app.application.merchant.pickup_qr import (
            is_pickup_fulfillment,
            normalize_scanned_payload,
            verify_pickup_qr_token,
        )

        order_id, token_shop_id = verify_pickup_qr_token(normalize_scanned_payload(token))
        if token_shop_id != shop_id:
            raise ValueError("wrong_shop")

        existing = (
            await self._session.execute(
                select(OrderModel).where(OrderModel.id == order_id, OrderModel.shop_id == shop_id)
            )
        ).scalar_one_or_none()
        if not existing:
            raise ValueError("order_not_found")

        product = await self._repo.get_product_by_id(existing.product_id)
        shop = await self._repo.get_shop(shop_id)

        if not is_pickup_fulfillment(getattr(existing, "fulfillment_type", "pickup")):
            raise ValueError("not_pickup_order")

        prev_status = (existing.status or "").lower()
        already_completed = prev_status == "completed"

        if prev_status == "cancelled":
            raise ValueError("order_cancelled")

        if not already_completed:
            if prev_status not in QR_PICKUP_ALLOWED_STATUSES:
                raise ValueError("order_not_ready_for_pickup")
            order = await self._repo.update_order_status(
                shop_id=shop_id,
                order_id=order_id,
                status="completed",
            )
            if not order:
                raise ValueError("order_not_found")
            await self._finalize_completed_order(order.id, shop_id, prev_status)
            try:
                from app.application.merchant.growth_service import MerchantGrowthService

                await MerchantGrowthService(self._session).try_reward_referral(shop_id)
            except Exception:
                logger.debug("referral_reward_skipped", exc_info=True)
            await self._session.commit()
            await self._clear_tracking(order_id, shop_id)
            hub = MerchantWorkspaceHub(self._session)
            await hub.push_alert(
                shop_id,
                {
                    "type": "pickup_qr_scanned",
                    "title": "QR orqali berildi",
                    "body": f"{await self._resolve_customer_name(existing) or _format_phone_label(existing.customer_phone)} — {product.name if product else 'Mahsulot'} olib ketdi",
                },
            )
            await self._notify_customer_status(
                order,
                new_status="completed",
                prev_status=prev_status,
                product_name=product.name if product else None,
            )
            try:
                from app.application.loyalty.customer_coin_service import CustomerCoinService

                await CustomerCoinService(self._session).award_completed_order(order)
            except Exception:
                logger.exception("customer_coin_award_failed", extra={"order_id": str(order.id)})
            existing = order

        customer_name = await self._resolve_customer_name(existing)
        return self._build_scan_response(
            existing,
            product,
            shop,
            already_completed=already_completed,
            customer_name=customer_name,
        )

    async def _resolve_customer_name(self, order: OrderModel) -> str | None:
        from sqlalchemy import select

        from app.infrastructure.db.models import AppUserModel

        user_id = getattr(order, "customer_user_id", None)
        if not user_id:
            return None
        row = (
            await self._session.execute(select(AppUserModel.display_name).where(AppUserModel.id == user_id))
        ).scalar_one_or_none()
        if row and str(row).strip():
            return str(row).strip()
        return None

    @staticmethod
    def _build_scan_response(
        order: OrderModel,
        product: ProductModel | None,
        shop: ShopModel | None,
        *,
        already_completed: bool,
        customer_name: str | None = None,
    ) -> dict[str, Any]:
        phone = str(order.customer_phone or "")
        customer_label = (customer_name or "").strip() or _format_phone_label(phone)
        product_name = product.name if product else "Mahsulot"
        qty = int(order.quantity or 1)
        unit_price = int(product.price) if product else 0
        product_image = None
        if product and product.images:
            product_image = str(product.images[0]).strip() or None
        payment_raw = getattr(order, "payment_method", None)
        payment_label = _PAYMENT_LABELS.get(str(payment_raw or "").lower(), payment_raw)

        if already_completed:
            headline = f"{customer_label} — bu buyurtma allaqachon olib ketilgan"
        else:
            headline = f"{customer_label} «{product_name}» ni olib ketdi"

        return {
            "order_id": str(order.id),
            "status": order.status,
            "already_completed": already_completed,
            "completed_via": "qr_scan",
            "headline": headline,
            "customer_name": customer_name,
            "customer_label": customer_label,
            "customer_phone": phone,
            "quantity": qty,
            "total_price": int(order.total_price or 0),
            "unit_price": unit_price,
            "payment_method": payment_raw,
            "payment_label": payment_label,
            "pickup_date": order.pickup_date.isoformat() if getattr(order, "pickup_date", None) else None,
            "pickup_time": getattr(order, "pickup_time", None),
            "completed_at": datetime.now(timezone.utc).isoformat() if not already_completed else None,
            "product": {
                "id": str(product.id) if product else "",
                "name": product_name,
                "price": unit_price,
                "image_url": product_image,
            },
            "items": [
                {
                    "product_id": str(product.id) if product else "",
                    "name": product_name,
                    "quantity": qty,
                    "unit_price": unit_price,
                    "line_total": int(order.total_price or 0),
                    "image_url": product_image,
                }
            ],
            "shop": {
                "id": str(shop.id) if shop else "",
                "name": shop.name if shop else "",
            },
        }

    async def get_pickup_qr_for_customer(
        self,
        order_id: UUID,
        customer_phone: str | None = None,
        *,
        customer_user_id: UUID | None = None,
        customer_email: str | None = None,
    ) -> dict[str, Any]:
        from app.application.merchant.pickup_qr import (
            CUSTOMER_QR_VISIBLE_STATUSES,
            build_pickup_qr_image_url,
            is_pickup_fulfillment,
            issue_pickup_qr_token,
        )

        order = await self._repo.get_order_for_account(
            order_id,
            user_id=customer_user_id,
            phone=customer_phone,
            email=customer_email,
        )
        if not order:
            raise ValueError("order_not_found")
        if not is_pickup_fulfillment(getattr(order, "fulfillment_type", "pickup")):
            raise ValueError("not_pickup_order")
        status = (order.status or "").lower()
        if status not in CUSTOMER_QR_VISIBLE_STATUSES:
            raise ValueError("qr_not_ready")
        product = order.product
        token, exp = issue_pickup_qr_token(order.id, order.shop_id)
        return {
            "order_id": str(order.id),
            "qr_token": token,
            "qr_image_url": build_pickup_qr_image_url(token),
            "expires_at": exp,
            "status": order.status,
            "product_name": product.name if product else "",
            "quantity": int(order.quantity or 1),
            "total_price": int(order.total_price or 0),
            "pickup_date": order.pickup_date.isoformat() if getattr(order, "pickup_date", None) else None,
            "pickup_time": getattr(order, "pickup_time", None),
            "hint": "Do'konda sotuvchiga ushbu QR ni ko'rsating — skaner qilgach buyurtma yopiladi.",
        }

    async def _notify_customer_status(
        self,
        order: OrderModel,
        *,
        new_status: str,
        prev_status: str | None,
        product_name: str | None = None,
    ) -> None:
        from app.application.marketplace.customer_order_notify_dispatch import (
            dispatch_customer_order_status_notify,
        )

        name = product_name
        if not name and order.product_id:
            product = await self._repo.get_product_by_id(order.product_id)
            name = product.name if product else "Mahsulot"
        await dispatch_customer_order_status_notify(
            self._session,
            order=order,
            product_name=name or "Mahsulot",
            new_status=new_status,
            prev_status=prev_status,
        )

    async def confirm_pickup_manual(
        self,
        shop_id: UUID,
        order_id: UUID,
        *,
        note: str | None = None,
    ) -> dict[str, Any]:
        raise ValueError("pickup_requires_qr_scan")

    async def get_arrival_meta(self, order_id: UUID) -> dict[str, Any] | None:
        raw = await self._cache.get(f"arrival:order:{order_id}")
        return raw if isinstance(raw, dict) else None

    async def _complete_order(self, shop_id: UUID, order_id: UUID, *, source: str) -> bool:
        from sqlalchemy import select

        existing = (
            await self._session.execute(
                select(OrderModel).where(OrderModel.id == order_id, OrderModel.shop_id == shop_id)
            )
        ).scalar_one_or_none()
        if not existing:
            return False
        prev_status = (existing.status or "").lower()
        if prev_status in {"completed", "cancelled"}:
            return False

        order = await self._repo.update_order_status(
            shop_id=shop_id,
            order_id=order_id,
            status="completed",
        )
        if not order:
            return False
        await self._finalize_completed_order(order.id, shop_id, prev_status)
        try:
            from app.application.merchant.growth_service import MerchantGrowthService

            await MerchantGrowthService(self._session).try_reward_referral(shop_id)
        except Exception:
            logger.debug("referral_reward_skipped", exc_info=True)
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

    async def _finalize_completed_order(self, order_id: UUID, shop_id: UUID, prev_status: str) -> None:
        if prev_status != "completed":
            from app.application.finance.transaction_splitter import TransactionSplitterService

            splitter = TransactionSplitterService(self._session)
            try:
                await splitter.release_escrow_to_merchant(order_id)
            except Exception:
                logger.exception("escrow_release_failed", extra={"order_id": str(order_id)})
        await self._accrue_offline_pickup_debt(order_id)

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
                f"Olib ketilgan bo'lsa 📷 QR Skaner orqali tasdiqlang."
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
                "body": f"{name} — {int(dwell_min)} daq bo'ldi, QR skaner bilan tasdiqlang",
            },
        )
