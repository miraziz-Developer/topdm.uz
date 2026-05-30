"""Kostyum/kamar demo mahsulotlarini mavjud bazaga qo'shish (rasm qidiruv uchun)."""
from __future__ import annotations

import asyncio
import os
import sys
import uuid

from sqlalchemy import select

from seed import PRODUCTS, SHOPS, CATEGORY_TREE, pick_product_image, make_product_embedding


def _bootstrap() -> None:
    here = os.path.abspath(os.path.dirname(__file__))
    for candidate in (os.path.join(here, "..", "backend"), os.path.join(here, "..")):
        if os.path.isdir(os.path.join(candidate, "app")):
            sys.path.insert(0, candidate)
            return
    raise RuntimeError("backend not found")


_bootstrap()
sys.path.insert(0, os.path.dirname(__file__))

from app.core.config import get_settings
from app.core.slug import slugify
from app.infrastructure.db.models import CategoryModel, ProductModel, ShopModel
from app.infrastructure.db.session import AsyncSessionFactory

NEW_NAMES = ("Erkak klassik kostyum kurtka", "Erkak charm kamar")


async def main() -> None:
    get_settings()
    added = 0
    async with AsyncSessionFactory() as db:
        shops = (await db.execute(select(ShopModel))).scalars().all()
        if not shops:
            print("Do'kon yo'q — avval seed.py ishga tushiring")
            return
        shop_by_name = {s.name: s for s in shops}
        cats = (await db.execute(select(CategoryModel))).scalars().all()
        sub_by_name: dict[str, uuid.UUID] = {c.name: c.id for c in cats if c.parent_id}

        for row in PRODUCTS:
            name = row[0]
            if name not in NEW_NAMES:
                continue
            exists = await db.scalar(select(ProductModel.id).where(ProductModel.name == name))
            if exists:
                continue
            desc, price, root_i, sub_i, shop_i, sale_type, min_qty, extra = row[1:]
            shop_meta = SHOPS[shop_i]
            shop = shop_by_name.get(shop_meta["name"]) or shops[0]
            sub_name = CATEGORY_TREE[root_i]["subs"][sub_i]
            sub_id = sub_by_name.get(sub_name)
            if not sub_id:
                print(f"Kategoriya topilmadi: {sub_name}")
                continue
            root_name = CATEGORY_TREE[root_i]["name"]
            attrs = {
                **extra,
                "root_category": root_name,
                "sub_category": sub_name,
                "category": sub_name,
                "market_zone": shop_meta["market_zone"],
                "block_sector": shop_meta["block_sector"],
                "location": shop_meta["location_label"],
                "floor": shop_meta["floor"],
                "shop_number": shop_meta["section"],
                "sale_type": sale_type,
            }
            product = ProductModel(
                shop_id=shop.id,
                category_id=sub_id,
                name=name,
                description=desc,
                price=price,
                sale_type=sale_type,
                min_order_quantity=min_qty,
                images=[pick_product_image(name, desc)],
                attributes=attrs,
                embedding=make_product_embedding(name, desc, attrs),
                is_available=True,
                is_featured=True,
                view_count=120,
            )
            db.add(product)
            added += 1
            print(f"  + {name}")
        await db.commit()
    print(f"Tayyor: {added} ta yangi mahsulot")


if __name__ == "__main__":
    asyncio.run(main())
