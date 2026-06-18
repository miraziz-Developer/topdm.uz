#!/usr/bin/env python3
"""
Mavjud do'konlarni o'chirmasdan katalogni kengaytirish (production-safe).

  python scripts/seed_grow_catalog.py
  python scripts/seed_grow_catalog.py --bulk 200
  docker compose exec backend python /app/scripts/seed_grow_catalog.py --bulk 250

Qo'shadi: bozor hududlari, seed do'konlari, asosiy mahsulotlar, bulk katalog.
REAL AVTO / merchant do'konlari saqlanadi.

⚠️  PRODUCTION REAL BOZOR: ishlatmang — faqat Unsplash demo.
    Haqiqiy do'konlar: Telegram bot → /register tez
"""
from __future__ import annotations

import argparse
import asyncio
import os
import random
import sys
import uuid

from sqlalchemy import func, select

random.seed(42)


def _bootstrap() -> None:
    here = os.path.abspath(os.path.dirname(__file__))
    for candidate in (os.path.join(here, "..", "backend"), os.path.join(here, "..")):
        if os.path.isdir(os.path.join(candidate, "app")):
            sys.path.insert(0, candidate)
            return
    raise RuntimeError("backend app topilmadi")


_bootstrap()
sys.path.insert(0, os.path.dirname(__file__))

from catalog_images import pick_catalog_image
from seed import (  # noqa: E402
    CATEGORY_TREE,
    IPADROMS,
    PRODUCTS,
    SHOPS,
    infer_shop_type,
    make_product_embedding,
    wholesale_pack_attrs,
)
from seed_bulk_ippodrom import seed_bulk  # noqa: E402

from app.application.map.store_locations import (  # noqa: E402
    indoor_pixel_to_wgs84,
    parse_shop_spatial,
    stall_map_point,
)
from app.core.slug import slugify  # noqa: E402
from app.infrastructure.db.models import CategoryModel, IpadromModel, ProductModel, ShopModel  # noqa: E402
from app.infrastructure.db.session import AsyncSessionFactory  # noqa: E402


async def _ensure_ipadroms(db) -> dict[str, uuid.UUID]:
    by_name: dict[str, uuid.UUID] = {}
    rows = (await db.execute(select(IpadromModel))).scalars().all()
    for row in rows:
        by_name[row.name] = row.id
    for data in IPADROMS:
        if data["name"] in by_name:
            continue
        row = IpadromModel(**data)
        db.add(row)
        await db.flush()
        by_name[data["name"]] = row.id
        print(f"  + Bozor hududi: {data['name']}")
    return by_name


def _category_maps(cats: list[CategoryModel]) -> tuple[list[uuid.UUID], list[list[uuid.UUID]]]:
    roots = [c for c in cats if c.parent_id is None]
    roots.sort(key=lambda c: (c.sort_order or 0, c.name))
    root_ids = [c.id for c in roots]
    sub_ids: list[list[uuid.UUID]] = []
    for root in roots:
        subs = [c for c in cats if c.parent_id == root.id]
        subs.sort(key=lambda c: c.name)
        sub_ids.append([c.id for c in subs])
    return root_ids, sub_ids


async def _ensure_seed_shops(db, ipadrom_by_name: dict[str, uuid.UUID]) -> list[uuid.UUID]:
    existing = (await db.execute(select(ShopModel))).scalars().all()
    by_phone = {(s.owner_phone or "").strip(): s for s in existing}
    by_slug = {(s.slug or "").strip(): s for s in existing}
    shop_ids: list[uuid.UUID] = [s.id for s in existing]
    used_slugs = set(by_slug.keys())

    for i, data in enumerate(SHOPS):
        phone = data["owner_phone"].strip()
        if phone in by_phone:
            continue
        base_slug = slugify(data["name"])
        slug = base_slug
        n = 1
        while slug in used_slugs:
            slug = f"{base_slug}-{n}"
            n += 1
        used_slugs.add(slug)
        ipadrom_name = IPADROMS[data["ipadrom_index"]]["name"]
        ipadrom_id = ipadrom_by_name.get(ipadrom_name)
        shop = ShopModel(
            owner_phone=data["owner_phone"],
            owner_email=data["owner_email"],
            name=data["name"],
            description=data["description"],
            floor=data["floor"],
            section=data["section"],
            slug=slug,
            ipadrom_id=ipadrom_id,
            shop_type=data.get("shop_type") or infer_shop_type(data),
            market_zone=data["market_zone"],
            block_sector=data["block_sector"],
            location_comment=data["location_label"],
            is_verified=True,
            is_featured=len(shop_ids) < 6,
            is_active=True,
        )
        spatial = parse_shop_spatial(shop)
        map_x, map_y = stall_map_point(spatial["block_id"], spatial["stall_number"])
        shop.latitude, shop.longitude = indoor_pixel_to_wgs84(map_x, map_y)
        db.add(shop)
        await db.flush()
        shop_ids.append(shop.id)
        print(f"  + Do'kon: {data['name']} ({slug})")

    return shop_ids


async def _add_seed_products(db, shop_ids: list[uuid.UUID]) -> int:
    cats = (await db.execute(select(CategoryModel))).scalars().all()
    if not cats:
        raise RuntimeError("Kategoriya yo'q — avval: python scripts/seed_categories.py")

    root_ids, sub_ids = _category_maps(cats)
    if not root_ids:
        raise RuntimeError("Root kategoriya topilmadi")

    shops = (await db.execute(select(ShopModel).where(ShopModel.id.in_(shop_ids)))).scalars().all()
    shop_by_index: dict[int, ShopModel] = {}
    seed_shop_names = {s["name"]: i for i, s in enumerate(SHOPS)}
    for shop in shops:
        if shop.name in seed_shop_names:
            shop_by_index[seed_shop_names[shop.name]] = shop

    existing_names = {
        n for (n,) in (await db.execute(select(ProductModel.name))).all()
    }
    added = 0

    for row in PRODUCTS:
        name, desc, price, root_i, sub_i, shop_i, sale_type, min_qty, extra = row
        if name in existing_names:
            continue
        shop = shop_by_index.get(shop_i)
        if shop is None:
            shop = shops[shop_i % len(shops)]
        if root_i >= len(root_ids) or sub_i >= len(sub_ids[root_i]):
            continue
        shop_meta = SHOPS[shop_i] if shop_i < len(SHOPS) else {
            "market_zone": shop.market_zone or "Ippodrom",
            "block_sector": shop.block_sector or "",
            "location_label": shop.location_comment or "",
            "floor": shop.floor or "",
            "section": shop.section or "",
        }
        root_name = CATEGORY_TREE[root_i]["name"] if root_i < len(CATEGORY_TREE) else "Kiyim-kechak & Moda"
        sub_name = (
            CATEGORY_TREE[root_i]["subs"][sub_i]
            if root_i < len(CATEGORY_TREE) and sub_i < len(CATEGORY_TREE[root_i]["subs"])
            else "Umumiy"
        )
        pack_meta = wholesale_pack_attrs(sale_type, min_qty)
        pricing_unit = pack_meta.get("pricing_unit", "piece")
        units_per_pack = None
        if sale_type == "Optom":
            units_per_pack = int(pack_meta["wholesale_pack"]["units_per_pack"])
        product = ProductModel(
            shop_id=shop.id,
            category_id=sub_ids[root_i][sub_i],
            name=name,
            description=desc,
            price=price,
            sale_type=sale_type,
            min_order_quantity=min_qty,
            pricing_unit=pricing_unit,
            units_per_pack=units_per_pack,
            images=[pick_catalog_image(name, desc)],
            attributes={
                **extra,
                **pack_meta,
                "root_category": root_name,
                "sub_category": sub_name,
                "category": sub_name,
                "market_zone": shop_meta["market_zone"],
                "block_sector": shop_meta["block_sector"],
                "location": shop_meta["location_label"],
                "floor": shop_meta["floor"],
                "shop_number": shop_meta["section"],
                "sale_type": sale_type,
                "min_order_quantity": min_qty,
            },
            embedding=make_product_embedding(
                name,
                desc,
                {**extra, "root_category": root_name, "sub_category": sub_name, "category": sub_name},
            ),
            is_available=True,
            is_featured=random.choice([True, False, False]),
            view_count=random.randint(40, 1200),
            stock_count=random.randint(5, 30),
        )
        db.add(product)
        existing_names.add(name)
        added += 1

    if added:
        await db.commit()
    print(f"  + Asosiy mahsulotlar: {added} ta")
    return added


async def _verify_shops_with_products(db) -> int:
    shop_ids = (
        await db.execute(
            select(ProductModel.shop_id)
            .where(ProductModel.is_available.is_(True))
            .distinct()
        )
    ).scalars().all()
    if not shop_ids:
        return 0
    from sqlalchemy import update

    result = await db.execute(
        update(ShopModel)
        .where(
            ShopModel.id.in_(shop_ids),
            ShopModel.is_active.is_(True),
            ShopModel.is_verified.is_(False),
        )
        .values(is_verified=True)
    )
    await db.commit()
    return int(result.rowcount or 0)


async def grow_catalog(*, bulk_target: int) -> dict[str, int]:
    stats = {"shops_before": 0, "products_before": 0, "seed_products": 0, "bulk_products": 0, "verified": 0}

    async with AsyncSessionFactory() as db:
        stats["shops_before"] = (await db.execute(select(func.count()).select_from(ShopModel))).scalar() or 0
        stats["products_before"] = (await db.execute(select(func.count()).select_from(ProductModel))).scalar() or 0

    print(f"📊 Hozir: {stats['shops_before']} do'kon, {stats['products_before']} mahsulot")

    async with AsyncSessionFactory() as db:
        ipadrom_by_name = await _ensure_ipadroms(db)
        shop_ids = await _ensure_seed_shops(db, ipadrom_by_name)
        await db.commit()

    stats["seed_products"] = await _add_seed_products(db, shop_ids)

    if bulk_target > 0:
        print(f"📦 Bulk katalog: +{bulk_target} mahsulot…")
        stats["bulk_products"] = await seed_bulk(bulk_target, skip_existing_names=True)

    async with AsyncSessionFactory() as db:
        stats["verified"] = await _verify_shops_with_products(db)

    async with AsyncSessionFactory() as db:
        shops_after = (await db.execute(select(func.count()).select_from(ShopModel))).scalar() or 0
        products_after = (await db.execute(select(func.count()).select_from(ProductModel))).scalar() or 0

    print(
        f"\n✅ Tayyor: {shops_after} do'kon (+{shops_after - stats['shops_before']}), "
        f"{products_after} mahsulot (+{products_after - stats['products_before']}), "
        f"verified yangilandi: {stats['verified']}"
    )
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Katalogni xavfsiz kengaytirish")
    parser.add_argument("--bulk", type=int, default=200, help="Qo'shimcha bulk mahsulotlar (default 200)")
    args = parser.parse_args()
    asyncio.run(grow_catalog(bulk_target=max(0, args.bulk)))


if __name__ == "__main__":
    main()
