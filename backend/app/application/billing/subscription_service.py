"""Merchant subscription (obuna) tizimi — bepuldan Pro ga o'tish, trial, renewal."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.billing.plans import (
    ALL_PLANS,
    PLAN_BY_CODE,
    FREE_PLAN,
    STARTER_PLAN,
    PRO_PLAN,
    SubscriptionPlan,
)
from app.infrastructure.repositories.wallet_repo import WalletRepository


def plan_to_dict(plan: SubscriptionPlan, *, active: bool = False, expires_at: datetime | None = None) -> dict[str, Any]:
    return {
        "code": plan.code,
        "name_uz": plan.name_uz,
        "price_uzs_monthly": plan.price_uzs_monthly,
        "price_uzs_yearly": plan.price_uzs_yearly,
        "max_products": plan.max_products,
        "max_images_per_product": plan.max_images_per_product,
        "featured_products": plan.featured_products,
        "ai_chat_enabled": plan.ai_chat_enabled,
        "analytics_full": plan.analytics_full,
        "qr_poster_enabled": plan.qr_poster_enabled,
        "priority_in_catalog": plan.priority_in_catalog,
        "trial_days": plan.trial_days,
        "description_uz": plan.description_uz,
        "is_active": active,
        "expires_at": expires_at.isoformat() if expires_at else None,
    }


class SubscriptionService:
    """Merchant subscription lifecycle — list, activate, renew, check limits."""

    def __init__(self, session: AsyncSession) -> None:
        self._db = session
        self._wallet = WalletRepository(session)

    # ── Public API ──────────────────────────────────────────────

    async def list_plans(self) -> list[dict[str, Any]]:
        """Barcha rejalari narx va xususiyat bilan."""
        return [plan_to_dict(p) for p in ALL_PLANS]

    async def get_shop_subscription(self, shop_id: UUID) -> dict[str, Any]:
        """Do'konning joriy obuna holati."""
        row = await self._fetch_subscription_row(shop_id)
        if not row:
            return {
                "plan": plan_to_dict(FREE_PLAN, active=True),
                "status": "free",
                "trial_active": False,
                "trial_ends_at": None,
                "next_renewal_at": None,
                "auto_renew": False,
                "can_upgrade": True,
            }

        plan_code = row["plan_code"]
        plan = PLAN_BY_CODE.get(plan_code, FREE_PLAN)
        expires_at = row.get("expires_at")
        now = datetime.now(timezone.utc)

        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        is_active = bool(row.get("is_active")) and (expires_at is None or expires_at > now)
        status = row["status"] if is_active else "expired"
        trial_ends = row.get("trial_ends_at")
        if isinstance(trial_ends, str):
            trial_ends = datetime.fromisoformat(trial_ends)

        return {
            "plan": plan_to_dict(plan, active=is_active, expires_at=expires_at),
            "status": status,
            "trial_active": bool(row.get("trial_active")) and (trial_ends is None or trial_ends > now),
            "trial_ends_at": trial_ends.isoformat() if trial_ends else None,
            "next_renewal_at": expires_at.isoformat() if expires_at else None,
            "auto_renew": bool(row.get("auto_renew")),
            "can_upgrade": plan_code != "pro",
        }

    async def activate_trial(self, shop_id: UUID, plan_code: str = "starter") -> dict[str, Any]:
        """Yangi do'kon uchun bepul sinov davri."""
        plan = PLAN_BY_CODE.get(plan_code, STARTER_PLAN)
        if plan.trial_days <= 0:
            raise ValueError("Bu reja uchun sinov davri yo'q")

        existing = await self._fetch_subscription_row(shop_id)
        if existing and existing.get("status") not in ("free", None):
            raise ValueError("Sinov davri avval foydalanilgan")

        now = datetime.now(timezone.utc)
        trial_ends = now + timedelta(days=plan.trial_days)
        expires_at = trial_ends

        await self._upsert_subscription(
            shop_id=shop_id,
            plan_code=plan.code,
            status="trial",
            is_active=True,
            trial_active=True,
            trial_ends_at=trial_ends,
            expires_at=expires_at,
            auto_renew=False,
        )
        await self._db.commit()

        return {
            "activated": True,
            "plan_code": plan.code,
            "trial_days": plan.trial_days,
            "trial_ends_at": trial_ends.isoformat(),
            "message": f"{plan.trial_days} kunlik sinov {plan.name_uz} rejasida boshlandi!",
        }

    async def subscribe_with_coins(
        self,
        shop_id: UUID,
        plan_code: str,
        period: str = "monthly",  # "monthly" | "yearly"
    ) -> dict[str, Any]:
        """Coin yechib obuna faollashtirish."""
        plan = PLAN_BY_CODE.get(plan_code)
        if not plan or plan.code == "free":
            raise ValueError("Noto'g'ri reja kodi")

        price = plan.price_uzs_monthly if period == "monthly" else plan.price_uzs_yearly
        if price <= 0:
            raise ValueError("Reja narxi noto'g'ri")

        coin_cost = max(1, round(price / 10_000))
        days = 30 if period == "monthly" else 365

        # Coindan yechib olish
        shop = await self._wallet.deduct_coins(shop_id, coin_cost)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=days)

        await self._upsert_subscription(
            shop_id=shop_id,
            plan_code=plan.code,
            status="active",
            is_active=True,
            trial_active=False,
            trial_ends_at=None,
            expires_at=expires_at,
            auto_renew=True,
        )
        await self._db.commit()

        return {
            "activated": True,
            "plan_code": plan.code,
            "period": period,
            "coins_spent": coin_cost,
            "coins_balance": int(shop.coins_balance),
            "expires_at": expires_at.isoformat(),
            "message": f"{plan.name_uz} rejasi {days} kunga faollashtirildi!",
        }

    async def check_product_limit(self, shop_id: UUID, current_count: int) -> dict[str, Any]:
        """Do'kon obunasi mahsulot limitini tekshirish."""
        if not self._settings.subscriptions_enabled:
            return {
                "can_add": True,
                "current_count": current_count,
                "limit": FREE_PLAN.max_products,
                "plan_code": "free",
                "upgrade_required": False,
                "message": None,
                "pricing_model": "product_markup",
            }
        sub = await self.get_shop_subscription(shop_id)
        plan = PLAN_BY_CODE.get(sub["plan"]["code"], FREE_PLAN)
        limit = plan.max_products
        can_add = current_count < limit

        return {
            "can_add": can_add,
            "current_count": current_count,
            "limit": limit,
            "plan_code": plan.code,
            "upgrade_required": not can_add,
            "message": None if can_add else f"Reja limiti: {limit} mahsulot. Pro rejaga o'ting.",
        }

    # ── Internal ────────────────────────────────────────────────

    async def _fetch_subscription_row(self, shop_id: UUID) -> dict[str, Any] | None:
        try:
            result = await self._db.execute(
                text("""
                    SELECT plan_code, status, is_active, trial_active,
                           trial_ends_at, expires_at, auto_renew
                    FROM merchant_subscriptions
                    WHERE shop_id = :shop_id
                    ORDER BY created_at DESC LIMIT 1
                """),
                {"shop_id": str(shop_id)},
            )
            row = result.mappings().first()
            return dict(row) if row else None
        except DBAPIError as exc:
            raise RuntimeError("merchant_subscriptions table is missing or unavailable") from exc

    async def _upsert_subscription(
        self,
        *,
        shop_id: UUID,
        plan_code: str,
        status: str,
        is_active: bool,
        trial_active: bool,
        trial_ends_at: datetime | None,
        expires_at: datetime | None,
        auto_renew: bool,
    ) -> None:
        now = datetime.now(timezone.utc)
        try:
            await self._db.execute(
                text("""
                    INSERT INTO merchant_subscriptions
                        (shop_id, plan_code, status, is_active, trial_active,
                         trial_ends_at, expires_at, auto_renew, created_at, updated_at)
                    VALUES
                        (:shop_id, :plan_code, :status, :is_active, :trial_active,
                         :trial_ends_at, :expires_at, :auto_renew, :now, :now)
                    ON CONFLICT (shop_id) DO UPDATE SET
                        plan_code = EXCLUDED.plan_code,
                        status = EXCLUDED.status,
                        is_active = EXCLUDED.is_active,
                        trial_active = EXCLUDED.trial_active,
                        trial_ends_at = EXCLUDED.trial_ends_at,
                        expires_at = EXCLUDED.expires_at,
                        auto_renew = EXCLUDED.auto_renew,
                        updated_at = EXCLUDED.updated_at
                """),
                {
                    "shop_id": str(shop_id),
                    "plan_code": plan_code,
                    "status": status,
                    "is_active": is_active,
                    "trial_active": trial_active,
                    "trial_ends_at": trial_ends_at,
                    "expires_at": expires_at,
                    "auto_renew": auto_renew,
                    "now": now,
                },
            )
        except DBAPIError as exc:
            raise RuntimeError("Failed to persist merchant subscription") from exc
