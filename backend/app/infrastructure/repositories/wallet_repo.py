from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import ShopModel


class InsufficientCoinBalanceError(ValueError):
    pass


class WalletRepository:
    """Row-locked coin balance on shops.coins_balance."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def lock_shop(self, shop_id: UUID) -> ShopModel:
        stmt = select(ShopModel).where(ShopModel.id == shop_id).with_for_update()
        result = await self._session.execute(stmt)
        shop = result.scalar_one_or_none()
        if not shop:
            raise ValueError("shop_not_found")
        return shop

    async def get_balance(self, shop_id: UUID) -> int:
        shop = await self._session.get(ShopModel, shop_id)
        if not shop:
            raise ValueError("shop_not_found")
        return int(shop.coins_balance or 0)

    async def add_coins(self, shop_id: UUID, amount: int) -> ShopModel:
        if amount < 1:
            raise ValueError("invalid_amount")
        shop = await self.lock_shop(shop_id)
        shop.coins_balance = int(shop.coins_balance or 0) + amount
        return shop

    async def deduct_coins(self, shop_id: UUID, amount: int) -> ShopModel:
        if amount < 1:
            raise ValueError("invalid_amount")
        shop = await self.lock_shop(shop_id)
        balance = int(shop.coins_balance or 0)
        if balance < amount:
            raise InsufficientCoinBalanceError("Insufficient Coin Balance")
        shop.coins_balance = balance - amount
        return shop

    async def sync_legacy_wallet(self, shop_id: UUID, balance: int) -> None:
        """Keep merchant_wallets in sync for backward compatibility."""
        from app.models.premium_banner import MerchantWalletModel

        wallet = await self._session.get(MerchantWalletModel, shop_id)
        if wallet:
            wallet.coin_balance = balance
            wallet.updated_at = datetime.now(timezone.utc)
        else:
            self._session.add(MerchantWalletModel(shop_id=shop_id, coin_balance=balance))
