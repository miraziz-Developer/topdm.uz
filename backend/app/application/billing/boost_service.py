"""Featured product boost — mahsulotni yuqoriga chiqarish."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.billing.plans import ALL_BOOSTS, BOOST_WEEK, BOOST_MONTH, BoostPackage
from app.application.crm_banners.service import COIN_UZS_RATE, uzs_to_coins
from app.infrastructure.repositories.wallet_repo import WalletRepository


class BoostService:
    def __init__(self, session: AsyncSession) -> None:
        self._db = session
        self._wallet = WalletRepository(session)

    async def list_packages(self) -> list[dict[str, Any]]:
        return [
            {
                "code": b.code,
                "name_uz": b.name_uz,
                "price_uzs": b.price_uzs,
                "duration_days": b.duration_days,
                "description_uz": b.description_uz,
            }
            for b in ALL_BOOSTS
        ]

    async def boost_product(
        self,
        *,
        shop_id: UUID,
        product_id: UUID,
        boost_code: str,
    ) -> dict[str, Any]:
        """Mahsulotni coin bilan yuqoriga chiqarish."""
        pkg = next((b for b in ALL_BOOSTS if b.code == boost_code), None)
        if not pkg:
            raise ValueError("Noto'g'ri boost kodi")

        coin_cost = uzs_to_coins(pkg.price_uzs)
        shop = await self._wallet.deduct_coins(shop_id, coin_cost)

        now = datetime.now(timezone.utc)
        ends_at = now + timedelta(days=pkg.duration_days)

        result = await self._db.execute(
            text("""
                UPDATE products
                SET is_featured = TRUE,
                    attributes = jsonb_set(
                        COALESCE(attributes, '{}'),
                        '{featured_until}',
                        to_jsonb(:ends_at::text)
                    )
                WHERE id = :product_id AND shop_id = :shop_id
            """),
            {
                "product_id": str(product_id),
                "shop_id": str(shop_id),
                "ends_at": ends_at.isoformat(),
            },
        )
        if result.rowcount == 0:
            raise ValueError("Mahsulot topilmadi yoki do'kon sizga tegishli emas")

        await self._db.commit()

        return {
            "boosted": True,
            "product_id": str(product_id),
            "boost_code": boost_code,
            "duration_days": pkg.duration_days,
            "ends_at": ends_at.isoformat(),
            "amount_uzs": pkg.price_uzs,
            "balance_uzs": int(shop.coins_balance) * COIN_UZS_RATE,
            "message": f"Mahsulot {pkg.duration_days} kun «Featured» sifatida ko'rsatiladi!",
        }

    async def get_active_boosts(self, shop_id: UUID) -> list[dict[str, Any]]:
        """Do'konning faol boost mahsulotlari."""
        try:
            result = await self._db.execute(
                text("""
                    SELECT id, name, attributes->>'featured_until' AS featured_until, is_featured
                    FROM products
                    WHERE shop_id = :shop_id
                      AND is_featured = TRUE
                    ORDER BY view_count DESC
                """),
                {"shop_id": str(shop_id)},
            )
        except DBAPIError as exc:
            raise RuntimeError("Failed to fetch boosted products") from exc

        rows = result.mappings().all()
        now = datetime.now(timezone.utc)
        active: list[dict[str, Any]] = []
        for r in rows:
            fu = r.get("featured_until")
            if not fu:
                continue
            try:
                fu_dt = datetime.fromisoformat(str(fu))
            except ValueError:
                continue
            if fu_dt.tzinfo is None:
                fu_dt = fu_dt.replace(tzinfo=timezone.utc)
            if fu_dt > now:
                active.append({
                    "product_id": str(r["id"]),
                    "name": r["name"],
                    "featured_until": fu_dt.isoformat(),
                    "days_left": (fu_dt - now).days,
                })
        return active
