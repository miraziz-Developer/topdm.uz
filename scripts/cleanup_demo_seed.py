"""
Demo seed ma'lumotlarini olib tashlash (scripts/seed.py dan qo'shilgan do'konlar).
Haqiqiy merchant do'konlari (masalan brend-rows) saqlanadi.

Ishlatish: python scripts/cleanup_demo_seed.py
"""
from __future__ import annotations

import asyncio
import os
import sys

from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


def _bootstrap_import_path() -> None:
    here = os.path.abspath(os.path.dirname(__file__))
    for candidate in (os.path.join(here, "..", "backend"), os.path.join(here, "..")):
        if os.path.isdir(os.path.join(candidate, "app")):
            sys.path.insert(0, candidate)
            return
    raise RuntimeError("Could not locate backend app package")


_bootstrap_import_path()

from app.core.config import get_settings
from app.infrastructure.db.models import (
    LeadModel,
    MerchantPendingProductModel,
    OrderModel,
    ProductModel,
    ShopModel,
    TrackingEventModel,
)
from app.models.premium_banner import SponsoredBannerModel

# scripts/seed.py dagi demo do'konlar
SEED_OWNER_PHONES = {
    "+998901110001",
    "+998901110002",
    "+998901110003",
    "+998901110004",
    "+998901110005",
    "+998901110006",
}

SEED_OWNER_EMAILS = {
    "anor@bozorliii.uz",
    "dubai@bozorliii.uz",
    "turkiya@bozorliii.uz",
    "kozgalovka@bozorliii.uz",
    "mato@bozorliii.uz",
    "sport@bozorliii.uz",
}


async def cleanup() -> None:
    settings = get_settings()
    engine = create_async_engine(settings.async_database_url, echo=False)
    Session = async_sessionmaker(bind=engine, expire_on_commit=False)

    async with Session() as db:
        result = await db.execute(
            select(ShopModel).where(
                or_(
                    ShopModel.owner_phone.in_(SEED_OWNER_PHONES),
                    ShopModel.owner_email.in_(SEED_OWNER_EMAILS),
                )
            )
        )
        seed_shops = list(result.scalars().all())
        if not seed_shops:
            print("Demo seed do'kon topilmadi — tozalash shart emas.")
            return

        shop_ids = [s.id for s in seed_shops]
        names = [f"{s.name} ({s.slug})" for s in seed_shops]
        print(f"O'chiriladigan demo do'konlar ({len(seed_shops)}):")
        for n in names:
            print(f"  - {n}")

        product_ids = select(ProductModel.id).where(ProductModel.shop_id.in_(shop_ids))

        await db.execute(delete(SponsoredBannerModel).where(SponsoredBannerModel.shop_id.in_(shop_ids)))
        await db.execute(delete(LeadModel).where(LeadModel.product_id.in_(product_ids)))
        await db.execute(delete(OrderModel).where(OrderModel.product_id.in_(product_ids)))
        await db.execute(delete(TrackingEventModel).where(TrackingEventModel.product_id.in_(product_ids)))
        await db.execute(
            MerchantPendingProductModel.__table__.update()
            .where(MerchantPendingProductModel.published_product_id.in_(product_ids))
            .values(published_product_id=None)
        )
        await db.execute(delete(ProductModel).where(ProductModel.shop_id.in_(shop_ids)))
        await db.execute(delete(ShopModel).where(ShopModel.id.in_(shop_ids)))
        await db.commit()

        try:
            from app.infrastructure.cache.premium_carousel_cache import PremiumCarouselCache

            await PremiumCarouselCache().bump_invalidation()
        except Exception:
            pass

        print(f"\n✅ {len(seed_shops)} ta demo do'kon va ularning mahsulot/bannerlari o'chirildi.")


if __name__ == "__main__":
    asyncio.run(cleanup())
