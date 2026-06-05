from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.crm_banners.service import _banner_crm_dict
from app.application.media.banner_image_processor import process_banner_upload
from app.application.premium_banners.service import _banner_to_slide
from app.infrastructure.cache.premium_carousel_cache import PremiumCarouselCache
from app.infrastructure.repositories.premium_banner_repo import PremiumBannerRepository
from app.infrastructure.repositories.wallet_repo import InsufficientCoinBalanceError, WalletRepository
from app.infrastructure.storage.object_store import ObjectMediaStore
from app.models.premium_banner import SponsoredBannerModel


def resolve_tariff_coin_cost(tariff, *, days: int | None = None) -> int:
    from app.application.crm_banners.pricing import banner_price_for_days

    if days is not None:
        _, coin_cost, _ = banner_price_for_days(tariff, days)
        return coin_cost
    if tariff.coin_cost and int(tariff.coin_cost) > 0:
        return int(tariff.coin_cost)
    from app.application.crm_banners.service import uzs_to_coins

    return uzs_to_coins(tariff.price_uzs_monthly or 0)


class BannerPurchaseService:
    """Atomic coin purchase → active sponsored banner."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._banners = PremiumBannerRepository(session)
        self._wallet = WalletRepository(session)
        self._media = ObjectMediaStore()

    async def purchase_with_coins(
        self,
        *,
        shop_id: UUID,
        tariff_code: str,
        duration_days: int = 30,
        image_bytes: bytes | None,
        image_url: str | None,
        title: str | None,
        product_id: UUID | None,
        cta_path: str | None,
    ) -> dict[str, Any]:
        tariff = await self._banners.get_tariff_by_code(tariff_code)
        if not tariff:
            raise ValueError("unknown_tariff")

        if image_bytes:
            processed = process_banner_upload(image_bytes)
            final_url = await self._media.save_banner_image(
                shop_id=shop_id,
                image_bytes=processed.data,
                extension=processed.extension,
                content_type=processed.content_type,
            )
        elif image_url and image_url.strip():
            final_url = image_url.strip()
        else:
            raise ValueError("image_required")

        from app.application.crm_banners.pricing import banner_price_for_days

        amount_uzs, coin_price, package_days = banner_price_for_days(tariff, duration_days)
        amount = Decimal(str(amount_uzs))
        queue_pos = await self._banners.next_queue_position(tariff.id)
        now = datetime.now(timezone.utc)

        try:
            shop = await self._wallet.deduct_coins(shop_id, coin_price)
            await self._wallet.sync_legacy_wallet(shop_id, int(shop.coins_balance))

            banner = SponsoredBannerModel(
                shop_id=shop_id,
                tariff_id=tariff.id,
                title=(title or "").strip() or None,
                image_url=final_url,
                product_id=product_id,
                cta_path=cta_path,
                status="active",
                is_active=True,
                package_days=package_days,
                queue_position=queue_pos,
                amount_uzs=amount,
                coins_spent=coin_price,
                payment_method="coin",
                paid_at=now,
                starts_at=now,
                ends_at=now + timedelta(days=package_days),
            )
            created = await self._banners.create_banner(banner)
            await self._banners.add_payment_transaction(
                banner_id=created.id,
                shop_id=shop_id,
                tariff_code=tariff.code,
                amount_uzs=amount,
                payment_method="coin",
                coin_amount=coin_price,
                metadata_json='{"source":"purchase"}',
            )
            await self._session.commit()
        except InsufficientCoinBalanceError as exc:
            await self._session.rollback()
            raise ValueError("Insufficient Coin Balance") from exc
        except Exception:
            await self._session.rollback()
            raise

        await PremiumCarouselCache().bump_invalidation()
        await self._session.refresh(created, attribute_names=["tariff", "shop"])

        from app.application.crm_banners.service import COIN_UZS_RATE

        return {
            "status": "active",
            "balance_uzs": int(shop.coins_balance) * COIN_UZS_RATE,
            "amount_uzs": amount_uzs,
            "banner": _banner_crm_dict(created),
            "carousel_slide": _banner_to_slide(created),
        }
