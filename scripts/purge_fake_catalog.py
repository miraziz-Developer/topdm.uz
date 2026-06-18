"""
Seed / demo / placeholder katalogni bazadan olib tashlash.

Saqlanadi: /api/v1/media/ yoki /uploads/ dagi haqiqiy merchant rasmlari.

Ishlatish:
  python scripts/purge_fake_catalog.py --dry-run
  python scripts/purge_fake_catalog.py
  docker compose exec backend python /app/scripts/purge_fake_catalog.py
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys


def _bootstrap_import_path() -> None:
    here = os.path.abspath(os.path.dirname(__file__))
    for candidate in (os.path.join(here, "..", "backend"), os.path.join(here, "..")):
        if os.path.isdir(os.path.join(candidate, "app")):
            sys.path.insert(0, candidate)
            return
    raise RuntimeError("Could not locate backend app package")


_bootstrap_import_path()

from sqlalchemy import delete, func, select, text  # noqa: E402

from app.infrastructure.db.session import AsyncSessionFactory  # noqa: E402
from app.infrastructure.db.models import (  # noqa: E402
    LeadModel,
    MerchantCredentialModel,
    MerchantPendingProductModel,
    OrderModel,
    ProductModel,
    ShopModel,
    TrackingEventModel,
)

SEED_EMAIL_SUFFIX = "@bozorliii.uz"


def _has_real_media(images: list[str] | None) -> bool:
    for url in images or []:
        u = (url or "").strip()
        if "/api/v1/media/" in u or u.startswith("/uploads/"):
            return True
    return False


def is_fake_product(product: ProductModel) -> bool:
    """Unsplash/placeholder seed — haqiqiy yuklangan rasm yo'q."""
    return not _has_real_media(product.images)


def is_seed_demo_shop(shop: ShopModel, *, has_credentials: bool) -> bool:
    """scripts/seed.py demo do'konlari — Telegram merchant emas."""
    if has_credentials:
        return False
    if (shop.registration_source or "").strip().lower() == "telegram":
        return False
    if shop.telegram_chat_id:
        return False
    email = (shop.owner_email or "").strip().lower()
    if email.endswith(SEED_EMAIL_SUFFIX):
        return True
    return False


async def _shops_to_purge_seed(db, *, dry_run: bool) -> list:
    shops = (await db.execute(select(ShopModel))).scalars().all()
    purge_ids: list = []
    for shop in shops:
        cred_count = (
            await db.execute(
                select(func.count())
                .select_from(MerchantCredentialModel)
                .where(MerchantCredentialModel.shop_id == shop.id)
            )
        ).scalar() or 0
        if not is_seed_demo_shop(shop, has_credentials=cred_count > 0):
            continue
        prod_count = (
            await db.execute(
                select(func.count()).select_from(ProductModel).where(ProductModel.shop_id == shop.id)
            )
        ).scalar() or 0
        if prod_count > 0:
            continue
        purge_ids.append(shop.id)
        label = f"{shop.name} ({shop.slug})"
        print(f"  {'[dry-run] ' if dry_run else ''}Seed do'kon o'chiriladi: {label}")
    return purge_ids


async def purge_fake_catalog(*, dry_run: bool = False, purge_seed_shops: bool = True) -> dict[str, int]:
    stats = {
        "products_deleted": 0,
        "orders_deleted": 0,
        "leads_deleted": 0,
        "tracking_deleted": 0,
        "reels_deleted": 0,
        "products_kept": 0,
        "seed_shops_deleted": 0,
    }

    async with AsyncSessionFactory() as db:
        products = (await db.execute(select(ProductModel))).scalars().all()
        fake_ids: list = []
        kept: list[str] = []
        for p in products:
            if is_fake_product(p):
                fake_ids.append(p.id)
            else:
                kept.append(str(p.id))

        stats["products_kept"] = len(kept)
        print(f"Mahsulotlar: jami={len(products)} fake={len(fake_ids)} saqlanadi={len(kept)}")
        if kept:
            print("  Saqlanadi:", ", ".join(kept[:8]), ("…" if len(kept) > 8 else ""))

        if not fake_ids:
            print("O'chirish kerak bo'lgan fake mahsulot yo'q.")
            return stats

        if dry_run:
            print("DRY-RUN — o'chirilmadi.")
            stats["products_deleted"] = len(fake_ids)
            if purge_seed_shops:
                print("\nSeed demo do'konlar (mahsulot tozalangandan keyin):")
                await _shops_to_purge_seed(db, dry_run=True)
            return stats

        await db.execute(delete(LeadModel).where(LeadModel.product_id.in_(fake_ids)))
        await db.execute(delete(TrackingEventModel).where(TrackingEventModel.product_id.in_(fake_ids)))
        ord_res = await db.execute(delete(OrderModel).where(OrderModel.product_id.in_(fake_ids)))
        stats["orders_deleted"] = ord_res.rowcount or 0

        await db.execute(
            MerchantPendingProductModel.__table__.update()
            .where(MerchantPendingProductModel.published_product_id.in_(fake_ids))
            .values(published_product_id=None)
        )

        prod_res = await db.execute(delete(ProductModel).where(ProductModel.id.in_(fake_ids)))
        stats["products_deleted"] = prod_res.rowcount or len(fake_ids)

        if purge_seed_shops:
            print("\nSeed demo do'konlar (faqat @bozorliii.uz, Telegram emas):")
            seed_shop_ids = await _shops_to_purge_seed(db, dry_run=False)
            if seed_shop_ids:
                shop_res = await db.execute(delete(ShopModel).where(ShopModel.id.in_(seed_shop_ids)))
                stats["seed_shops_deleted"] = shop_res.rowcount or len(seed_shop_ids)

        await db.commit()
        print(
            f"✅ O'chirildi: {stats['products_deleted']} mahsulot, "
            f"{stats['orders_deleted']} buyurtma, "
            f"{stats['seed_shops_deleted']} seed do'kon"
        )
        print(f"   Saqlanadi: {stats['products_kept']} haqiqiy mahsulot (merchant media)")
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Fake seed katalogni tozalash")
    parser.add_argument("--dry-run", action="store_true", help="Faqat hisobot, o'chirmaslik")
    parser.add_argument(
        "--keep-seed-shops",
        action="store_true",
        help="Seed do'kon yozuvlarini saqlash (mahsulotlar baribir tozalanadi)",
    )
    args = parser.parse_args()
    asyncio.run(purge_fake_catalog(dry_run=args.dry_run, purge_seed_shops=not args.keep_seed_shops))


if __name__ == "__main__":
    main()
