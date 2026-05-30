from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.indoor_navigation.fixtures import get_market_geofence
from app.application.indoor_navigation.geofence import geofence_status, gps_to_local_point, haversine_meters
from app.application.indoor_navigation.market_map_loader import load_market_map
from app.application.merchant.workspace_draft import load_workspace_draft, merge_workspace_draft
from app.application.merchant.workspace_hub import MerchantWorkspaceHub
from app.core.config import get_settings
from app.infrastructure.cache.redis_gateway import RedisCacheGateway
from app.infrastructure.db.models import OrderModel, ProductModel, ShopModel
from app.infrastructure.messaging.notifier_service import TelegramNotifierGateway

logger = logging.getLogger(__name__)

APPROACH_TTL_SECONDS = 3 * 60 * 60
ACTIVE_ORDER_STATUSES = frozenset({"pending", "reserved", "confirmed", "preparing", "ready", "new"})
DEFAULT_RADIUS_KM = 10.0
MAX_ALERT_RADIUS_KM = 10.0
GRID_LAT = 0.0045  # ~500 m
GRID_LNG = 0.0055


def _mask_phone(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) >= 4:
        tail = digits[-4:]
        return f"+998 ** *** {tail[:2]} {tail[2:]}"
    return "+998 ** *** ****"


def _quantize_latlng(lat: float, lng: float) -> tuple[float, float]:
    return (
        round(lat / GRID_LAT) * GRID_LAT,
        round(lng / GRID_LNG) * GRID_LNG,
    )


def _quantize_local(x: float, y: float, step: float = 40.0) -> tuple[float, float]:
    return (round(x / step) * step, round(y / step) * step)


def _round_distance_m(meters: float) -> int:
    if meters < 1000:
        return int(round(meters / 100.0) * 100)
    return int(round(meters / 500.0) * 500)


def _distance_band(distance_m: float, *, inside_market: bool) -> str:
    if inside_market:
        if distance_m <= 120:
            return "yaqin"
        return "bozorda"
    if distance_m >= 10_000:
        return "10km+"
    if distance_m >= 5000:
        return "5km"
    if distance_m >= 2000:
        return "2km"
    if distance_m >= 1000:
        return "1km"
    if distance_m >= 500:
        return "500m"
    return "yaqin"


def _band_label_uz(band: str) -> str:
    labels = {
        "10km+": "10 km atrofida",
        "5km": "~5 km",
        "2km": "~2 km",
        "1km": "~1 km",
        "500m": "~500 m",
        "bozorda": "Bozorda",
        "yaqin": "Juda yaqin",
    }
    return labels.get(band, band)


async def get_approach_settings(shop_id: UUID) -> dict[str, Any]:
    draft = await load_workspace_draft(shop_id)
    raw = draft.get("approach_settings") if isinstance(draft.get("approach_settings"), dict) else {}
    radius = float(raw.get("alert_radius_km") or DEFAULT_RADIUS_KM)
    radius = max(1.0, min(radius, MAX_ALERT_RADIUS_KM))
    settings = {
        "enabled": bool(raw.get("enabled", True)),
        "alert_radius_km": radius,
        "show_on_map": bool(raw.get("show_on_map", True)),
        "max_alert_radius_km": MAX_ALERT_RADIUS_KM,
    }
    logger.info(
        "approach_settings_loaded shop_id=%s radius_km=%.0f max_km=%.0f enabled=%s",
        shop_id,
        radius,
        MAX_ALERT_RADIUS_KM,
        settings["enabled"],
    )
    return settings


async def set_approach_settings(shop_id: UUID, payload: dict[str, Any]) -> dict[str, Any]:
    current = await get_approach_settings(shop_id)
    if "enabled" in payload:
        current["enabled"] = bool(payload["enabled"])
    if "show_on_map" in payload:
        current["show_on_map"] = bool(payload["show_on_map"])
    if "alert_radius_km" in payload and payload["alert_radius_km"] is not None:
        requested = float(payload["alert_radius_km"])
        clamped = max(1.0, min(requested, MAX_ALERT_RADIUS_KM))
        if requested > MAX_ALERT_RADIUS_KM:
            logger.warning(
                "approach_radius_clamped shop_id=%s requested_km=%.1f max_km=%.0f",
                shop_id,
                requested,
                MAX_ALERT_RADIUS_KM,
            )
        current["alert_radius_km"] = clamped
    current["max_alert_radius_km"] = MAX_ALERT_RADIUS_KM
    await merge_workspace_draft(shop_id, {"approach_settings": current})
    logger.info(
        "approach_settings_saved shop_id=%s radius_km=%.0f max_km=%.0f enabled=%s",
        shop_id,
        current["alert_radius_km"],
        MAX_ALERT_RADIUS_KM,
        current["enabled"],
    )
    return current


class CustomerApproachService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._cache = RedisCacheGateway()
        self._settings = get_settings()

    async def record_ping(
        self,
        order_id: UUID,
        *,
        customer_phone: str | None,
        lat: float | None = None,
        lng: float | None = None,
        local_x: float | None = None,
        local_y: float | None = None,
        market_slug: str = "ippodrom",
        level: int = 1,
        trusted: bool = False,
    ) -> dict[str, Any]:
        order = await self._session.get(OrderModel, order_id)
        if not order:
            raise ValueError("order_not_found")
        if (order.status or "").lower() not in ACTIVE_ORDER_STATUSES:
            raise ValueError("order_not_active")

        if customer_phone:
            normalized = self._normalize_phone(customer_phone)
            order_phone = self._normalize_phone(order.customer_phone)
            if normalized != order_phone:
                raise ValueError("phone_mismatch")
        elif not trusted:
            raise ValueError("phone_required")

        shop = await self._session.get(ShopModel, order.shop_id)
        if not shop:
            raise ValueError("shop_not_found")

        product = await self._session.get(ProductModel, order.product_id)
        settings = await get_approach_settings(shop.id)
        if not settings["enabled"]:
            return {"recorded": False, "reason": "tracking_disabled"}

        geo = await self._resolve_position(
            shop=shop,
            market_slug=market_slug,
            level=level,
            lat=lat,
            lng=lng,
            local_x=local_x,
            local_y=local_y,
        )
        distance_m = float(geo["distance_m"])
        radius_m = settings["alert_radius_km"] * 1000.0
        if distance_m > radius_m and not geo["inside_market"]:
            await self._cache.delete(f"approach:order:{order_id}")
            return {
                "recorded": False,
                "reason": "outside_radius",
                "distance_m": _round_distance_m(distance_m),
            }

        band = _distance_band(distance_m, inside_market=geo["inside_market"])
        now = datetime.now(timezone.utc).isoformat()
        payload = {
            "order_id": str(order_id),
            "shop_id": str(shop.id),
            "customer_label": _mask_phone(order.customer_phone),
            "product_name": product.name if product else "",
            "order_status": order.status,
            "pickup_date": order.pickup_date.isoformat() if order.pickup_date else None,
            "pickup_time": order.pickup_time,
            "distance_m": _round_distance_m(distance_m),
            "distance_band": band,
            "distance_label": _band_label_uz(band),
            "inside_market": geo["inside_market"],
            "map_x": geo["map_x"],
            "map_y": geo["map_y"],
            "updated_at": now,
            "privacy_note": "Taxminiy joy — aniq GPS emas",
        }
        await self._cache.set(f"approach:order:{order_id}", payload, ttl_seconds=APPROACH_TTL_SECONDS)
        await self._register_shop_visitor(shop.id, str(order_id))
        await self._maybe_notify(shop, order, payload, settings)

        from app.application.merchant.order_pickup_completion import OrderPickupCompletionService

        pickup = OrderPickupCompletionService(self._session)
        arrival = await pickup.process_location_ping(
            order,
            shop,
            product,
            distance_m=distance_m,
            inside_market=bool(geo["inside_market"]),
            approach_payload=payload,
        )
        return {"recorded": True, **payload, **arrival}

    async def list_incoming_visitors(self, shop_id: UUID) -> dict[str, Any]:
        settings = await get_approach_settings(shop_id)
        order_ids = await self._shop_visitor_ids(shop_id)
        visitors: list[dict[str, Any]] = []
        radius_m = settings["alert_radius_km"] * 1000.0

        for oid in order_ids:
            raw = await self._cache.get(f"approach:order:{oid}")
            if not raw or str(raw.get("shop_id")) != str(shop_id):
                continue
            if float(raw.get("distance_m") or 0) > radius_m and not raw.get("inside_market"):
                continue
            visitors.append(raw)

        visitors.sort(key=lambda v: float(v.get("distance_m") or 999999))
        active_orders = await self._active_orders_without_ping(shop_id, seen={v["order_id"] for v in visitors})

        logger.info(
            "incoming_visitors_list shop_id=%s radius_km=%.0f max_km=%.0f on_route=%d reserved=%d",
            shop_id,
            settings["alert_radius_km"],
            MAX_ALERT_RADIUS_KM,
            len(visitors),
            len(active_orders),
        )
        return {
            "settings": settings,
            "visitors": visitors,
            "reserved_without_location": active_orders,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    def _normalize_phone(phone: str) -> str:
        digits = "".join(c for c in phone if c.isdigit())
        if len(digits) == 9:
            return f"+998{digits}"
        if len(digits) == 12 and digits.startswith("998"):
            return f"+{digits}"
        return phone.strip()

    async def _resolve_position(
        self,
        *,
        shop: ShopModel,
        market_slug: str,
        level: int,
        lat: float | None,
        lng: float | None,
        local_x: float | None,
        local_y: float | None,
    ) -> dict[str, Any]:
        geofence = get_market_geofence(market_slug)
        shop_anchor = await self._shop_map_anchor(shop, market_slug, level)

        inside_market = False
        map_x = shop_anchor["x"]
        map_y = shop_anchor["y"]

        if lat is not None and lng is not None:
            q_lat, q_lng = _quantize_latlng(lat, lng)
            status = geofence_status(q_lat, q_lng, geofence)
            inside_market = bool(status.get("inside"))
            pin = gps_to_local_point(q_lat, q_lng, geofence)
            map_x, map_y = _quantize_local(float(pin["x"]), float(pin["y"]))
            if inside_market:
                distance_m = math.hypot(map_x - shop_anchor["x"], map_y - shop_anchor["y"]) * 0.45
            else:
                center = geofence.get("center") or {}
                target_lat = float(shop.latitude or center.get("lat") or q_lat)
                target_lng = float(shop.longitude or center.get("lng") or q_lng)
                distance_m = haversine_meters(q_lat, q_lng, target_lat, target_lng)
        elif local_x is not None and local_y is not None:
            map_x, map_y = _quantize_local(float(local_x), float(local_y))
            inside_market = True
            distance_m = math.hypot(map_x - shop_anchor["x"], map_y - shop_anchor["y"]) * 0.45
        else:
            distance_m = 99999.0

        return {
            "distance_m": max(0.0, distance_m),
            "inside_market": inside_market,
            "map_x": map_x,
            "map_y": map_y,
        }

    async def _shop_map_anchor(self, shop: ShopModel, market_slug: str, level: int) -> dict[str, float]:
        try:
            payload = await load_market_map(market_slug, self._session)
            level_payload = next((item for item in payload["levels"] if item["level"] == level), None)
            graph = (level_payload or {}).get("navigation_graph") or {}
            nodes = graph.get("nodes") or {}
            if shop.indoor_stall_id:
                from app.infrastructure.db.models import IndoorStallModel

                stall = await self._session.get(IndoorStallModel, shop.indoor_stall_id)
                if stall and stall.graph_node_id in nodes:
                    node = nodes[stall.graph_node_id]
                    return {"x": float(node.get("x") or 200), "y": float(node.get("y") or 120)}
            block = (shop.block_sector or "A")[:1].upper()
            stall_no = shop.stall_number or "12"
            guess = f"stall-{block}-{stall_no}"
            if guess in nodes:
                node = nodes[guess]
                return {"x": float(node.get("x") or 200), "y": float(node.get("y") or 120)}
            if nodes:
                first = next(iter(nodes.values()))
                return {"x": float(first.get("x") or 200), "y": float(first.get("y") or 120)}
        except Exception:
            pass
        return {"x": 200.0, "y": 120.0}

    async def _register_shop_visitor(self, shop_id: UUID, order_id: str) -> None:
        key = f"approach:shop:{shop_id}"
        existing = await self._cache.get(key)
        ids = list(existing.get("order_ids", [])) if isinstance(existing, dict) else []
        if order_id not in ids:
            ids.insert(0, order_id)
        ids = ids[:40]
        await self._cache.set(key, {"order_ids": ids}, ttl_seconds=APPROACH_TTL_SECONDS)

    async def _shop_visitor_ids(self, shop_id: UUID) -> list[str]:
        raw = await self._cache.get(f"approach:shop:{shop_id}")
        if isinstance(raw, dict):
            return [str(x) for x in raw.get("order_ids") or []]
        return []

    async def _active_orders_without_ping(self, shop_id: UUID, *, seen: set[str]) -> list[dict[str, Any]]:
        result = await self._session.execute(
            select(OrderModel, ProductModel)
            .join(ProductModel, ProductModel.id == OrderModel.product_id)
            .where(OrderModel.shop_id == shop_id, OrderModel.status.in_(list(ACTIVE_ORDER_STATUSES)))
            .order_by(OrderModel.created_at.desc())
            .limit(20)
        )
        rows: list[dict[str, Any]] = []
        for order, product in result.all():
            oid = str(order.id)
            if oid in seen:
                continue
            rows.append(
                {
                    "order_id": oid,
                    "customer_label": _mask_phone(order.customer_phone),
                    "product_name": product.name,
                    "order_status": order.status,
                    "pickup_date": order.pickup_date.isoformat() if order.pickup_date else None,
                    "pickup_time": order.pickup_time,
                    "note": "Joylashuv hali yo'q — mijoz xaritaga kirganda ko'rinadi",
                }
            )
        return rows[:8]

    async def _maybe_notify(
        self,
        shop: ShopModel,
        order: OrderModel,
        payload: dict[str, Any],
        settings: dict[str, Any],
    ) -> None:
        band = str(payload.get("distance_band") or "")
        notify_bands = {"5km", "2km", "1km", "500m", "bozorda", "yaqin"}
        if band not in notify_bands:
            return
        dedupe_key = f"approach:notify:{order.id}:{band}"
        if await self._cache.get(dedupe_key):
            return
        await self._cache.set(dedupe_key, {"ok": True}, ttl_seconds=APPROACH_TTL_SECONDS)

        hub = MerchantWorkspaceHub(self._session)
        label = payload.get("distance_label") or band
        product_name = payload.get("product_name") or "mahsulot"
        await hub.push_alert(
            shop.id,
            {
                "type": "customer_approaching",
                "title": "Mijoz yaqinlashmoqda",
                "body": f"{product_name} · {label} · {payload.get('customer_label')}",
            },
        )
        if shop.telegram_chat_id and self._settings.telegram_bot_token:
            notifier = TelegramNotifierGateway(self._settings.telegram_bot_token)
            text = (
                f"Mijoz yo'lda (bron): {product_name}\n"
                f"Masofa: {label}\n"
                f"Mijoz: {payload.get('customer_label')}\n"
                f"CRM xaritada ko'ring."
            )
            try:
                await notifier.send_message(int(shop.telegram_chat_id), text)
            except Exception:
                pass
