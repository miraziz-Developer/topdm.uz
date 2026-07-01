from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.premium_banners.service import _banner_to_slide
from app.core.config import get_settings
from app.infrastructure.repositories.premium_banner_repo import PremiumBannerRepository
from app.infrastructure.storage.object_store import ObjectMediaStore
from app.models.premium_banner import SponsoredBannerModel

# 1 Bozor Coin = 1 000 UZS — startup bosqichi (O'zbekiston bozori)
COIN_UZS_RATE = 1_000


def uzs_to_coins(amount_uzs: Decimal | float) -> int:
    return max(1, int(round(float(amount_uzs) / COIN_UZS_RATE)))


def _banner_crm_dict(banner: SponsoredBannerModel) -> dict[str, Any]:
    tariff = banner.tariff
    impressions = int(banner.impression_count or 0)
    clicks = int(banner.click_count or 0)
    ctr = float(banner.ctr_percent or 0) if banner.ctr_percent is not None else (
        round((clicks / impressions) * 100, 2) if impressions > 0 else 0.0
    )
    now = datetime.now(timezone.utc)
    ends = banner.ends_at
    if ends.tzinfo is None:
        ends = ends.replace(tzinfo=timezone.utc)
    seconds_left = max(0, int((ends - now).total_seconds())) if banner.status == "active" else 0

    return {
        "id": str(banner.id),
        "shop_id": str(banner.shop_id),
        "status": banner.status,
        "title": banner.title,
        "image_url": banner.image_url,
        "tariff_code": tariff.code if tariff else "bronze",
        "tariff_label": tariff.name_uz if tariff else "Bronze",
        "package_days": banner.package_days,
        "queue_position": banner.queue_position,
        "amount_uzs": float(banner.amount_uzs) if banner.amount_uzs is not None else None,
        "payment_method": banner.payment_method,
        "paid_at": banner.paid_at.isoformat() if banner.paid_at else None,
        "starts_at": banner.starts_at.isoformat() if banner.starts_at else None,
        "ends_at": banner.ends_at.isoformat() if banner.ends_at else None,
        "seconds_remaining": seconds_left,
        "impressions_count": impressions,
        "clicks_count": clicks,
        "ctr_percent": ctr,
        "is_active": banner.is_active,
        "created_at": banner.created_at.isoformat() if banner.created_at else None,
    }


class CrmBannerService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._settings = get_settings()
        self._repo = PremiumBannerRepository(session)
        self._media = ObjectMediaStore()

    async def list_tariffs(self) -> list[dict[str, Any]]:
        from app.application.crm_banners.pricing import tariff_public_dict

        rows = await self._repo.list_active_tariffs()
        return [tariff_public_dict(t) for t in rows]

    async def quote_tariff(self, tariff_code: str, days: int) -> dict[str, Any]:
        from app.application.crm_banners.pricing import quote_banner

        tariff = await self._repo.get_tariff_by_code(tariff_code)
        if not tariff:
            raise ValueError("unknown_tariff")
        return quote_banner(tariff, days)

    async def get_wallet(self, shop_id: UUID) -> dict[str, Any]:
        from app.infrastructure.repositories.wallet_repo import WalletRepository

        balance = await WalletRepository(self._session).get_balance(shop_id)
        return {
            "shop_id": str(shop_id),
            "balance_uzs": balance * COIN_UZS_RATE,
            "coin_balance": balance,
            "coins_balance": balance,
        }

    async def list_shop_campaigns(self, shop_id: UUID) -> dict[str, Any]:
        expired = await self._repo.expire_due_banners()
        if expired:
            await self._session.commit()
            from app.infrastructure.cache.premium_carousel_cache import PremiumCarouselCache

            await PremiumCarouselCache().bump_invalidation()
        banners = await self._repo.list_shop_banners(shop_id)
        return {"items": [_banner_crm_dict(b) for b in banners]}

    async def create_pending_banner(
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
        content_type: str = "image/jpeg",
        extension: str = "jpg",
    ) -> dict[str, Any]:
        tariff = await self._repo.get_tariff_by_code(tariff_code)
        if not tariff:
            raise ValueError("unknown_tariff")

        if image_bytes:
            from app.application.media.banner_image_processor import process_banner_upload

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

        amount_uzs, _coins, package_days = banner_price_for_days(tariff, duration_days)
        amount = Decimal(str(amount_uzs))
        queue_pos = await self._repo.next_queue_position(tariff.id)
        now = datetime.now(timezone.utc)

        banner = SponsoredBannerModel(
            shop_id=shop_id,
            tariff_id=tariff.id,
            title=(title or "").strip() or None,
            image_url=final_url,
            product_id=product_id,
            cta_path=cta_path,
            status="pending_payment",
            is_active=False,
            package_days=package_days,
            queue_position=queue_pos,
            amount_uzs=amount,
            starts_at=now,
            ends_at=now,
        )
        created = await self._repo.create_banner(banner)
        await self._session.commit()
        return {
            "status": "pending_payment",
            "banner": _banner_crm_dict(created),
            "payment": {
                "amount_uzs": float(amount),
                "amount_coins": uzs_to_coins(amount),
                "tariff_code": tariff.code,
                "package_days": package_days,
                "queue_position": queue_pos,
            },
        }

    async def verify_payment(
        self,
        *,
        shop_id: UUID,
        banner_id: UUID,
        payment_method: str,
        external_reference: str | None = None,
    ) -> dict[str, Any]:
        await self._repo.expire_due_banners()
        banner = await self._repo.get_banner(banner_id)
        if not banner or banner.shop_id != shop_id:
            raise ValueError("banner_not_found")
        if banner.status != "pending_payment":
            raise ValueError("invalid_status")

        tariff = banner.tariff
        if not tariff:
            raise ValueError("tariff_missing")

        amount = Decimal(str(banner.amount_uzs or tariff.price_uzs_monthly or 0))
        method = payment_method.strip().lower()
        coin_amount: int | None = None

        if method == "coin":
            coin_amount = uzs_to_coins(amount)
            try:
                await self._repo.deduct_coins(shop_id, coin_amount)
            except ValueError as exc:
                if "Insufficient Coin Balance" in str(exc):
                    raise ValueError("Insufficient Coin Balance") from exc
                raise
        elif method in ("click", "payme"):
            raise ValueError("use_banner_online_checkout_endpoint")
        else:
            raise ValueError("invalid_payment_method")

        return await self._activate_banner_payment(
            banner=banner,
            shop_id=shop_id,
            tariff=tariff,
            amount=amount,
            method=method,
            coin_amount=coin_amount,
            external_reference=external_reference,
        )

    async def create_online_checkout(
        self,
        *,
        shop_id: UUID,
        banner_id: UUID,
        provider: str,
    ) -> dict[str, Any]:
        if not self._settings.enable_online_checkout:
            raise ValueError("online_checkout_disabled")

        banner = await self._repo.get_banner(banner_id)
        if not banner or banner.shop_id != shop_id:
            raise ValueError("banner_not_found")
        if banner.status != "pending_payment":
            raise ValueError("invalid_status")

        amount = int(banner.amount_uzs or 0)
        if amount <= 0:
            raise ValueError("invalid_amount")

        prov = provider.strip().lower()
        if prov not in ("click", "payme"):
            raise ValueError("invalid_provider")

        from app.infrastructure.repositories.order_payment_repo import OrderPaymentRepository

        checkout = await OrderPaymentRepository(self._session).create_pending(
            order_ids=[],
            amount_uzs=amount,
            provider=prov,
            purpose="banner",
            shop_id=shop_id,
            meta={"banner_id": str(banner_id)},
        )
        await self._session.commit()

        base = (
            (self._settings.payment_checkout_base_url or self._settings.site_url or "https://bozorliii.uz")
            .rstrip("/")
        )
        checkout_url = f"{base}/checkout/{prov}?checkout_id={checkout.id}&amount={amount}"
        return {
            "checkout_id": str(checkout.id),
            "amount_uzs": amount,
            "provider": prov,
            "checkout_url": checkout_url,
            "purpose": "banner",
        }

    async def activate_banner_after_online_payment(
        self,
        *,
        shop_id: UUID,
        banner_id: UUID,
        payment_method: str,
        external_reference: str | None,
    ) -> dict[str, Any]:
        banner = await self._repo.get_banner(banner_id)
        if not banner or banner.shop_id != shop_id:
            raise ValueError("banner_not_found")
        if banner.status == "active":
            return {"status": "active", "banner": _banner_crm_dict(banner)}
        if banner.status != "pending_payment":
            raise ValueError("invalid_status")

        tariff = banner.tariff
        if not tariff:
            raise ValueError("tariff_missing")

        amount = Decimal(str(banner.amount_uzs or tariff.price_uzs_monthly or 0))
        return await self._activate_banner_payment(
            banner=banner,
            shop_id=shop_id,
            tariff=tariff,
            amount=amount,
            method=payment_method.strip().lower(),
            coin_amount=None,
            external_reference=external_reference,
        )

    async def _activate_banner_payment(
        self,
        *,
        banner: SponsoredBannerModel,
        shop_id: UUID,
        tariff,
        amount: Decimal,
        method: str,
        coin_amount: int | None,
        external_reference: str | None,
    ) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        package_days = int(banner.package_days or tariff.duration_days or 30)
        banner.status = "active"
        banner.is_active = True
        banner.payment_method = method
        banner.paid_at = now
        banner.starts_at = now
        banner.ends_at = now + timedelta(days=package_days)

        await self._repo.add_payment_transaction(
            banner_id=banner.id,
            shop_id=shop_id,
            tariff_code=tariff.code,
            amount_uzs=amount,
            payment_method=method,
            coin_amount=coin_amount,
            external_reference=external_reference,
            metadata_json=json.dumps({"package_days": package_days, "queue_position": banner.queue_position}),
        )
        await self._session.commit()
        await self._session.refresh(banner, attribute_names=["tariff", "shop"])

        from app.infrastructure.cache.premium_carousel_cache import PremiumCarouselCache

        await PremiumCarouselCache().bump_invalidation()

        return {
            "status": "active",
            "banner": _banner_crm_dict(banner),
            "carousel_slide": _banner_to_slide(banner),
        }

    async def renew_banner(
        self,
        *,
        shop_id: UUID,
        banner_id: UUID,
        tariff_code: str | None = None,
        duration_days: int | None = None,
    ) -> dict[str, Any]:
        """Clone an expired/near-expiry campaign into a new pending_payment slot."""
        old = await self._repo.get_banner(banner_id)
        if not old or old.shop_id != shop_id:
            raise ValueError("banner_not_found")
        code = (tariff_code or (old.tariff.code if old.tariff else "bronze")).lower()
        days = duration_days if duration_days is not None else int(old.package_days or 30)
        return await self.create_pending_banner(
            shop_id=shop_id,
            tariff_code=code,
            duration_days=days,
            image_bytes=None,
            image_url=old.image_url,
            title=old.title,
            product_id=old.product_id,
            cta_path=old.cta_path,
        )

    async def get_banner_stats(self, shop_id: UUID, banner_id: UUID) -> dict[str, Any]:
        banner = await self._repo.get_banner(banner_id)
        if not banner or banner.shop_id != shop_id:
            raise ValueError("banner_not_found")

        impressions = int(banner.impression_count or 0)
        clicks = int(banner.click_count or 0)
        ctr = round((clicks / impressions) * 100, 2) if impressions > 0 else 0.0
        txs = await self._repo.list_banner_transactions(banner_id)

        return {
            "banner_id": str(banner.id),
            "status": banner.status,
            "impressions_count": impressions,
            "clicks_count": clicks,
            "ctr_percent": ctr,
            "starts_at": banner.starts_at.isoformat() if banner.starts_at else None,
            "ends_at": banner.ends_at.isoformat() if banner.ends_at else None,
            "transactions": [
                {
                    "id": str(t.id),
                    "amount_uzs": float(t.amount_uzs),
                    "coin_amount": t.coin_amount,
                    "tariff_code": t.tariff_code,
                    "payment_method": t.payment_method,
                    "status": t.status,
                    "transaction_timestamp": t.transaction_timestamp.isoformat(),
                }
                for t in txs
            ],
        }
