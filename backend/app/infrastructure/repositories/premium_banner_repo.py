from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.db.models import ShopModel
from app.models.premium_banner import (
    BannerPaymentTransactionModel,
    MerchantWalletModel,
    PremiumTariffModel,
    SponsoredBannerModel,
)


def _ctr_value(impressions: int, clicks: int) -> Decimal:
    if impressions <= 0:
        return Decimal("0")
    return Decimal(str(round((clicks / impressions) * 100, 4)))


class PremiumBannerRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_active_tariffs(self) -> list[PremiumTariffModel]:
        stmt = (
            select(PremiumTariffModel)
            .where(PremiumTariffModel.is_active.is_(True))
            .order_by(PremiumTariffModel.priority_weight.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_tariff_by_code(self, code: str) -> PremiumTariffModel | None:
        stmt = select(PremiumTariffModel).where(PremiumTariffModel.code == code.strip().lower())
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_banner(self, banner_id: UUID) -> SponsoredBannerModel | None:
        stmt = (
            select(SponsoredBannerModel)
            .options(
                selectinload(SponsoredBannerModel.shop),
                selectinload(SponsoredBannerModel.tariff),
                selectinload(SponsoredBannerModel.product),
            )
            .where(SponsoredBannerModel.id == banner_id)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_shop_banners(self, shop_id: UUID, *, limit: int = 50) -> list[SponsoredBannerModel]:
        stmt = (
            select(SponsoredBannerModel)
            .options(
                selectinload(SponsoredBannerModel.tariff),
                selectinload(SponsoredBannerModel.shop),
            )
            .where(SponsoredBannerModel.shop_id == shop_id)
            .order_by(SponsoredBannerModel.created_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_active_banners(self, *, limit: int = 48) -> list[SponsoredBannerModel]:
        now = datetime.now(timezone.utc)
        stmt = (
            select(SponsoredBannerModel)
            .options(
                selectinload(SponsoredBannerModel.shop),
                selectinload(SponsoredBannerModel.tariff),
                selectinload(SponsoredBannerModel.product),
            )
            .where(
                SponsoredBannerModel.status == "active",
                SponsoredBannerModel.is_active.is_(True),
                SponsoredBannerModel.starts_at <= now,
                SponsoredBannerModel.ends_at > now,
            )
            .order_by(
                PremiumTariffModel.priority_weight.desc(),
                SponsoredBannerModel.ends_at.asc(),
            )
            .join(PremiumTariffModel, SponsoredBannerModel.tariff_id == PremiumTariffModel.id)
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().unique().all())

    async def next_queue_position(self, tariff_id: UUID) -> int:
        stmt = select(func.count()).select_from(SponsoredBannerModel).where(
            SponsoredBannerModel.tariff_id == tariff_id,
            SponsoredBannerModel.status.in_(("pending_payment", "active")),
        )
        result = await self._session.execute(stmt)
        count = int(result.scalar_one() or 0)
        return count + 1

    async def create_banner(self, banner: SponsoredBannerModel) -> SponsoredBannerModel:
        self._session.add(banner)
        await self._session.flush()
        await self._session.refresh(banner, attribute_names=["shop", "tariff", "product"])
        return banner

    async def expire_due_banners(self) -> list[dict]:
        """Expire active banners past end_date; return rows for notifications."""
        now = datetime.now(timezone.utc)
        stmt = (
            select(SponsoredBannerModel, ShopModel)
            .join(ShopModel, SponsoredBannerModel.shop_id == ShopModel.id)
            .where(
                SponsoredBannerModel.status == "active",
                SponsoredBannerModel.ends_at <= now,
                SponsoredBannerModel.expired_notified_at.is_(None),
            )
        )
        result = await self._session.execute(stmt)
        rows = result.all()
        if not rows:
            return []

        expired_payload: list[dict] = []
        for banner, shop in rows:
            banner.status = "expired"
            banner.is_active = False
            banner.updated_at = now
            banner.expired_notified_at = now
            expired_payload.append(
                {
                    "banner_id": banner.id,
                    "shop_id": shop.id,
                    "shop_name": shop.name,
                    "telegram_chat_id": shop.telegram_chat_id,
                    "title": banner.title,
                }
            )
        await self._session.flush()
        return expired_payload

    async def increment_impression(self, banner_id: UUID) -> None:
        banner = await self.get_banner(banner_id)
        if not banner:
            return
        impressions = int(banner.impression_count or 0) + 1
        clicks = int(banner.click_count or 0)
        await self._session.execute(
            update(SponsoredBannerModel)
            .where(SponsoredBannerModel.id == banner_id)
            .values(
                impression_count=impressions,
                ctr_percent=_ctr_value(impressions, clicks),
            )
        )

    async def increment_click(self, banner_id: UUID) -> None:
        banner = await self.get_banner(banner_id)
        if not banner:
            return
        impressions = int(banner.impression_count or 0)
        clicks = int(banner.click_count or 0) + 1
        await self._session.execute(
            update(SponsoredBannerModel)
            .where(SponsoredBannerModel.id == banner_id)
            .values(
                click_count=clicks,
                ctr_percent=_ctr_value(impressions, clicks),
            )
        )

    async def get_wallet(self, shop_id: UUID) -> MerchantWalletModel:
        from app.infrastructure.repositories.wallet_repo import WalletRepository

        wallet_repo = WalletRepository(self._session)
        balance = await wallet_repo.get_balance(shop_id)
        await wallet_repo.sync_legacy_wallet(shop_id, balance)
        wallet = await self._session.get(MerchantWalletModel, shop_id)
        if wallet:
            wallet.coin_balance = balance
            return wallet
        wallet = MerchantWalletModel(shop_id=shop_id, coin_balance=balance)
        self._session.add(wallet)
        await self._session.flush()
        return wallet

    async def deduct_coins(self, shop_id: UUID, amount: int) -> MerchantWalletModel:
        from app.infrastructure.repositories.wallet_repo import InsufficientCoinBalanceError, WalletRepository

        wallet_repo = WalletRepository(self._session)
        try:
            shop = await wallet_repo.deduct_coins(shop_id, amount)
            await wallet_repo.sync_legacy_wallet(shop_id, int(shop.coins_balance))
        except InsufficientCoinBalanceError as exc:
            raise ValueError("Insufficient Coin Balance") from exc
        wallet = await self.get_wallet(shop_id)
        return wallet

    async def external_reference_used(self, external_reference: str) -> bool:
        ref = (external_reference or "").strip()
        if not ref:
            return False
        stmt = select(BannerPaymentTransactionModel.id).where(
            BannerPaymentTransactionModel.external_reference == ref,
            BannerPaymentTransactionModel.status == "completed",
        )
        row = await self._session.scalar(stmt)
        return row is not None

    async def add_payment_transaction(
        self,
        *,
        banner_id: UUID,
        shop_id: UUID,
        tariff_code: str,
        amount_uzs: Decimal,
        payment_method: str,
        coin_amount: int | None = None,
        external_reference: str | None = None,
        metadata_json: str | None = None,
    ) -> BannerPaymentTransactionModel:
        tx = BannerPaymentTransactionModel(
            banner_id=banner_id,
            shop_id=shop_id,
            tariff_code=tariff_code,
            amount_uzs=amount_uzs,
            coin_amount=coin_amount,
            payment_method=payment_method,
            status="completed",
            external_reference=external_reference,
            metadata_json=metadata_json,
        )
        self._session.add(tx)
        await self._session.flush()
        return tx

    async def list_banner_transactions(self, banner_id: UUID) -> list[BannerPaymentTransactionModel]:
        stmt = (
            select(BannerPaymentTransactionModel)
            .where(BannerPaymentTransactionModel.banner_id == banner_id)
            .order_by(BannerPaymentTransactionModel.transaction_timestamp.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
