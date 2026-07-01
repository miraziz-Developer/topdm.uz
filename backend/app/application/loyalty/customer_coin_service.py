from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import AppUserModel, OrderModel

logger = logging.getLogger(__name__)

COIN_UZS_RATE = 1_000
EARN_UZS_PER_COIN = 10_000
MAX_REDEEM_ORDER_FRACTION = 0.30


class InsufficientCustomerCoinsError(ValueError):
    pass


class CustomerCoinService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    @staticmethod
    def coins_for_purchase_amount(total_uzs: int) -> int:
        return max(1, int(total_uzs) // EARN_UZS_PER_COIN)

    @staticmethod
    def max_redeemable_coins(*, balance: int, order_total_uzs: int) -> int:
        if balance < 1 or order_total_uzs < 1:
            return 0
        by_total = order_total_uzs // COIN_UZS_RATE
        by_cap = int((order_total_uzs * MAX_REDEEM_ORDER_FRACTION) // COIN_UZS_RATE)
        return max(0, min(balance, by_total, by_cap))

    async def get_balance(self, user_id: UUID) -> int:
        user = await self._session.get(AppUserModel, user_id)
        if not user:
            return 0
        return int(user.coins_balance or 0)

    async def _lock_user(self, user_id: UUID) -> AppUserModel:
        result = await self._session.execute(
            select(AppUserModel).where(AppUserModel.id == user_id).with_for_update()
        )
        user = result.scalar_one_or_none()
        if not user:
            raise ValueError("user_not_found")
        return user

    async def redeem_for_order(
        self,
        user_id: UUID,
        *,
        order_total_uzs: int,
        coins_requested: int,
    ) -> tuple[int, int]:
        """Deduct coins; return (coins_used, discount_uzs)."""
        if coins_requested < 1:
            return 0, 0
        user = await self._lock_user(user_id)
        allowed = self.max_redeemable_coins(balance=int(user.coins_balance or 0), order_total_uzs=order_total_uzs)
        if coins_requested > allowed:
            raise InsufficientCustomerCoinsError("Coin yetarli emas yoki limit oshib ketdi")
        user.coins_balance = int(user.coins_balance or 0) - coins_requested
        return coins_requested, coins_requested * COIN_UZS_RATE

    async def refund_redeemed(self, order: OrderModel) -> None:
        redeemed = int(getattr(order, "loyalty_coins_redeemed", 0) or 0)
        if redeemed < 1 or not order.customer_user_id:
            return
        user = await self._lock_user(order.customer_user_id)
        user.coins_balance = int(user.coins_balance or 0) + redeemed
        order.loyalty_coins_redeemed = 0
        logger.info("customer_coins_refunded", extra={"order_id": str(order.id), "coins": redeemed})

    async def award_completed_order(self, order: OrderModel) -> int:
        if not order.customer_user_id:
            return 0
        if getattr(order, "loyalty_coins_awarded", False):
            return 0
        if (order.status or "").lower() != "completed":
            return 0

        coins = self.coins_for_purchase_amount(int(order.total_price or 0))
        user = await self._lock_user(order.customer_user_id)
        user.coins_balance = int(user.coins_balance or 0) + coins
        order.loyalty_coins_awarded = True
        logger.info(
            "customer_coins_awarded",
            extra={"order_id": str(order.id), "user_id": str(order.customer_user_id), "coins": coins},
        )
        return coins

    @staticmethod
    def loyalty_info() -> dict:
        return {
            "coin_uzs_rate": COIN_UZS_RATE,
            "earn_per_coin_uzs": EARN_UZS_PER_COIN,
            "max_redeem_order_pct": int(MAX_REDEEM_ORDER_FRACTION * 100),
            "rules_uz": (
                f"1 Coin = {COIN_UZS_RATE:,} so'm chegirma. "
                f"Har {EARN_UZS_PER_COIN:,} so'mlik yakunlangan xariddan 1 Coin. "
                f"Bir buyurtmada maksimum {int(MAX_REDEEM_ORDER_FRACTION * 100)}% Coin bilan to'lashingiz mumkin."
            ).replace(",", " "),
        }
