"""Mijoz buyurtma holati bildirishnomalari (Redis — tez, migratsiyasiz)."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.core.phone import normalize_uz_phone_e164
from app.infrastructure.cache.redis_gateway import RedisCacheGateway

NOTIF_TTL_SECONDS = 7 * 24 * 3600
MAX_ITEMS = 40

CUSTOMER_STATUS_MESSAGES: dict[str, tuple[str, str]] = {
    "confirmed": ("Buyurtma tasdiqlandi", "Do'kon buyurtmangizni qabul qildi"),
    "preparing": ("Tayyorlanmoqda", "Mahsulotingiz yig'ilmoqda"),
    "ready": ("Olib ketishga tayyor!", "Do'konga keling — QR kodingiz ochildi"),
    "completed": ("Buyurtma yakunlandi", "Mahsulot muvaffaqiyatli topshirildi"),
    "cancelled": ("Buyurtma bekor qilindi", "Savdo bekor qilindi"),
}


def _recipient_keys(*, user_id: UUID | None, phone: str | None) -> list[str]:
    keys: list[str] = []
    if user_id:
        keys.append(f"uid:{user_id}")
    if phone:
        norm = normalize_uz_phone_e164(phone)
        if norm:
            keys.append(f"ph:{norm.replace('+', '')}")
    return keys


class CustomerOrderNotificationService:
    def __init__(self) -> None:
        self._cache = RedisCacheGateway()

    async def push_order_status_change(
        self,
        *,
        order_id: UUID,
        user_id: UUID | None,
        phone: str | None,
        product_name: str,
        new_status: str,
        prev_status: str | None,
    ) -> None:
        new_status = (new_status or "").lower()
        prev = (prev_status or "").lower()
        if not new_status or new_status == prev:
            return
        tpl = CUSTOMER_STATUS_MESSAGES.get(new_status)
        if not tpl:
            return

        title, body = tpl
        item = {
            "id": str(uuid4()),
            "order_id": str(order_id),
            "status": new_status,
            "title": title,
            "body": body,
            "product_name": (product_name or "Mahsulot")[:120],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "read": False,
            "highlight": new_status == "ready",
        }
        for key in _recipient_keys(user_id=user_id, phone=phone):
            await self._append(f"cust_order_notif:{key}", item)

    async def list_for_customer(
        self,
        *,
        user_id: UUID | None,
        phone: str | None,
        unread_only: bool = False,
        limit: int = 20,
    ) -> list[dict]:
        merged: dict[str, dict] = {}
        for key in _recipient_keys(user_id=user_id, phone=phone):
            for row in await self._load(f"cust_order_notif:{key}"):
                merged[row["id"]] = row
        items = sorted(merged.values(), key=lambda x: x.get("created_at") or "", reverse=True)
        if unread_only:
            items = [x for x in items if not x.get("read")]
        return items[: max(1, min(limit, MAX_ITEMS))]

    async def mark_read(
        self,
        *,
        user_id: UUID | None,
        phone: str | None,
        notification_ids: list[str] | None = None,
        mark_all: bool = False,
    ) -> int:
        updated = 0
        id_set = set(notification_ids or [])
        for key in _recipient_keys(user_id=user_id, phone=phone):
            redis_key = f"cust_order_notif:{key}"
            rows = await self._load(redis_key)
            changed = False
            for row in rows:
                if mark_all or row.get("id") in id_set:
                    if not row.get("read"):
                        row["read"] = True
                        updated += 1
                        changed = True
            if changed:
                await self._cache.set(redis_key, rows, ttl_seconds=NOTIF_TTL_SECONDS)
        return updated

    async def _append(self, redis_key: str, item: dict) -> None:
        rows = await self._load(redis_key)
        rows.insert(0, item)
        await self._cache.set(redis_key, rows[:MAX_ITEMS], ttl_seconds=NOTIF_TTL_SECONDS)

    async def _load(self, redis_key: str) -> list[dict]:
        raw = await self._cache.get(redis_key)
        if not isinstance(raw, list):
            return []
        return [x for x in raw if isinstance(x, dict)]
