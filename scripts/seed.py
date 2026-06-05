"""
Bozorliii — Ippodrom / Abu Sahiy / Kozgalovka mega-bazaar seed.
Ishlatish: python scripts/seed.py
Tozalab qayta urinish: FORCE_RESEED=1 python scripts/seed.py
"""
from __future__ import annotations

import asyncio
import os
import random
import sys
import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


def _bootstrap_import_path() -> None:
    here = os.path.abspath(os.path.dirname(__file__))
    for candidate in (os.path.join(here, "..", "backend"), os.path.join(here, "..")):
        if os.path.isdir(os.path.join(candidate, "app")):
            sys.path.insert(0, candidate)
            return
    raise RuntimeError("Could not locate backend app package for seed script")


_bootstrap_import_path()

from app.application.map.store_locations import (
    indoor_pixel_to_wgs84,
    parse_shop_spatial,
    stall_map_point,
)
from app.core.config import get_settings
from app.core.slug import slugify
from app.infrastructure.ai_clients.embedding import _deterministic_embed
from app.infrastructure.db.base import Base
from app.infrastructure.db.models import (
    CategoryModel,
    IpadromModel,
    LeadModel,
    MerchantPendingProductModel,
    OrderModel,
    ProductModel,
    ShopModel,
    TrackingEventModel,
)

settings = get_settings()
engine = create_async_engine(settings.async_database_url, echo=False)
SessionFactory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

FORCE_RESEED = os.getenv("FORCE_RESEED", "").lower() in {"1", "true", "yes"}

IPADROMS = [
    {
        "name": "Abu Sahiy",
        "city": "Toshkent",
        "address": "Chilonzor, Abu Saxiy ulgurji majmuasi",
        "lat": 41.2381,
        "lng": 69.1765,
    },
    {
        "name": "Ippodrom bozori",
        "city": "Toshkent",
        "address": "Chilonzor, Ippodrom buyum bozori",
        "lat": 41.2346,
        "lng": 69.1834,
    },
    {
        "name": "Kozgalovka",
        "city": "Toshkent",
        "address": "Chilonzor, Kozgalovka optom kiyim",
        "lat": 41.2365,
        "lng": 69.1810,
    },
]

# 6 root domains → sub-categories
CATEGORY_TREE: list[dict] = [
    {
        "name": "Kiyim-kechak & Moda",
        "icon": "👗",
        "sort_order": 1,
        "subs": ["Sarpo & Kechki liboslar", "Bahoriy/Kuzgi ustki kiyim", "Sport majmualari"],
    },
    {
        "name": "Poyabzal",
        "icon": "👟",
        "sort_order": 2,
        "subs": ["Turkiya/Xitoy premium", "Erkaklar klassik", "Bolalar poyabzali"],
    },
    {
        "name": "Go'zallik & Parfümeriya",
        "icon": "✨",
        "sort_order": 3,
        "subs": ["Dubay atirlari optom", "Kosmetika & Parvarish"],
    },
    {
        "name": "Matolar & Tekstil",
        "icon": "🧵",
        "sort_order": 4,
        "subs": ["Pardabop matolar", "Sarpo gazmollari", "Uy tekstili"],
    },
    {
        "name": "Aksessuarlar",
        "icon": "👜",
        "sort_order": 5,
        "subs": ["Sumka & belbog'", "Soat & zargarlik"],
    },
    {
        "name": "Bolalar & Maktab",
        "icon": "🧒",
        "sort_order": 6,
        "subs": ["Maktab formasi", "Bolalar kundalik kiyim"],
    },
]

SHOPS = [
    {
        "owner_phone": "+998901110001",
        "owner_email": "anor@bozorliii.uz",
        "name": "Anor Boutique",
        "description": "Ayollar sarpo va kechki liboslar",
        "floor": "5-yo'lak",
        "section": "112-do'kon",
        "ipadrom_index": 1,
        "market_zone": "Ippodrom",
        "block_sector": "Chorsu bloki",
        "location_label": "Ippodrom - Chorsu bloki (Ayollar kiyimi), 5-Yo'lak, 112-Do'kon",
    },
    {
        "owner_phone": "+998901110002",
        "owner_email": "dubai@bozorliii.uz",
        "name": "Dubai Atir Optom",
        "description": "Dubay atirlari va parfyumeriya optom",
        "floor": "3-Blok",
        "section": "14-do'kon",
        "ipadrom_index": 0,
        "market_zone": "Abu Sahiy",
        "block_sector": "3-Blok",
        "location_label": "Abu Sahiy - 3-Blok (Elektronika/Aksessuarlar), 14-Do'kon",
    },
    {
        "owner_phone": "+998901110003",
        "owner_email": "turkiya@bozorliii.uz",
        "name": "Turkiya Premium Poyabzal",
        "description": "Turkiya va Xitoy premium poyabzal",
        "floor": "1-Glavniy",
        "section": "22-do'kon",
        "ipadrom_index": 0,
        "market_zone": "Abu Sahiy",
        "block_sector": "1-Glavniy",
        "location_label": "Abu Sahiy - 1-Glavniy (Poyabzal), 22-Do'kon",
    },
    {
        "owner_phone": "+998901110004",
        "owner_email": "kozgalovka@bozorliii.uz",
        "name": "Kozgalovka Optom Fashion",
        "description": "Ulgurji kiyim seriyalari",
        "floor": "2-yo'lak",
        "section": "45-do'kon",
        "ipadrom_index": 2,
        "market_zone": "Kozgalovka",
        "block_sector": "Optom kiyim bozori",
        "location_label": "Kozgalovka (Optom kiyim bozori), 2-Yo'lak, 45-Do'kon",
    },
    {
        "owner_phone": "+998901110005",
        "owner_email": "mato@bozorliii.uz",
        "name": "Sarpo Gazmol Markazi",
        "description": "Kelin sarpo va turk matolari",
        "floor": "Yevropa bloki",
        "section": "8-do'kon",
        "ipadrom_index": 0,
        "market_zone": "Abu Sahiy",
        "block_sector": "Yevropa bloki",
        "location_label": "Abu Sahiy - Yevropa bloki (Matolar), 8-Do'kon",
    },
    {
        "owner_phone": "+998901110006",
        "owner_email": "sport@bozorliii.uz",
        "name": "Sport Line Ippodrom",
        "description": "Sport majmualari chakana va optom",
        "floor": "Toshkent yo'lagi",
        "section": "31-do'kon",
        "ipadrom_index": 1,
        "market_zone": "Ippodrom",
        "block_sector": "Toshkent yo'lagi",
        "location_label": "Ippodrom - Toshkent yo'lagi (Sport), 31-Do'kon",
    },
]

# (name, desc, price, root_idx, sub_idx, shop_idx, sale_type, min_qty, extra_attrs)
PRODUCTS = [
    (
        "Kelin sarpo Turkiya mato (8m)",
        "Yuqori sifatli atlas-saten, to'y uchun",
        1_850_000,
        3,
        1,
        4,
        "Optom",
        5,
        {"material": "atlas", "color": "oq"},
    ),
    (
        "Pardabop blackout mato (rulon)",
        "Uy va ofis uchun qalin mato",
        420_000,
        3,
        0,
        4,
        "Optom",
        12,
        {"material": "poliester"},
    ),
    (
        "Ayollar kechki libos (platye)",
        "To'y va bayram uchun qizil atlas",
        680_000,
        0,
        0,
        0,
        "Chakana",
        1,
        {"material": "atlas", "season": "butun yil"},
    ),
    (
        "Bahoriy yengil kurtka",
        "Ayollar uchun bej rang",
        395_000,
        0,
        1,
        0,
        "Chakana",
        1,
        {"material": "paxta-aralash"},
    ),
    (
        "Erkaklar sport majmua",
        "Qora/oq, kundalik sport",
        410_000,
        0,
        2,
        5,
        "Chakana",
        1,
        {"material": "poliester", "color": "qora"},
    ),
    (
        "Ayollar sariq sport majmua",
        "Sviter va shim, yorqin sariq rang — rasmdagidek sport uslub",
        465_000,
        0,
        2,
        5,
        "Chakana",
        1,
        {"material": "poliester", "color": "sariq"},
    ),
    (
        "Sport majmua optom (seriya)",
        "10 dona seriya, o'lchamlar aralash",
        3_200_000,
        0,
        2,
        5,
        "Optom",
        10,
        {"material": "poliester"},
    ),
    (
        "Turkiya charm erkak tufli",
        "Klassik qora, 41–44",
        890_000,
        1,
        0,
        2,
        "Chakana",
        1,
        {"material": "charm"},
    ),
    (
        "Bolalar sport krossovkasi",
        "28–35 o'lcham",
        210_000,
        1,
        2,
        2,
        "Chakana",
        1,
        {"material": "sintetika"},
    ),
    (
        "Poyabzal optom seriya (12 juft)",
        "Turkiya import, aralash model",
        4_800_000,
        1,
        0,
        2,
        "Optom",
        12,
        {"material": "charm"},
    ),
    (
        "Dubay atir Lattafa (optom)",
        "12 dona quti, original import",
        2_400_000,
        2,
        0,
        1,
        "Optom",
        12,
        {"brand": "Lattafa"},
    ),
    (
        "Kosmetika to'plam (parvarish)",
        "Teri parvarishi set",
        185_000,
        2,
        1,
        1,
        "Chakana",
        1,
        {},
    ),
    (
        "Uy tekstili ko'rpa-to'qimachilik",
        "Ikki kishilik komplekt",
        520_000,
        3,
        2,
        4,
        "Chakana",
        1,
        {"material": "paxta"},
    ),
    (
        "Charm sumka (premium)",
        "Ayollar kundalik sumka",
        245_000,
        4,
        0,
        0,
        "Chakana",
        1,
        {"material": "charm"},
    ),
    (
        "Bolalar maktab formasi",
        "To'liq komplekt, 1–4-sinf",
        195_000,
        5,
        0,
        5,
        "Chakana",
        1,
        {"season": "butun yil"},
    ),
    (
        "Bolalar kundalik kostyum optom",
        "Seriya 8 dona, 6–12 yosh",
        1_120_000,
        5,
        1,
        3,
        "Optom",
        8,
        {"material": "paxta"},
    ),
    (
        "Erkaklar klassik ko'ylak",
        "Oq paxta, ofis uchun",
        165_000,
        0,
        1,
        5,
        "Chakana",
        1,
        {"material": "paxta"},
    ),
    (
        "Kelin ko'ylak namunasi (chakana)",
        "Oq rang, S–XL",
        890_000,
        0,
        0,
        0,
        "Chakana",
        1,
        {"material": "atlas"},
    ),
    (
        "Sarpo gazmol rulon (optom)",
        "6 rulon minimal buyurtma",
        5_400_000,
        3,
        1,
        4,
        "Optom",
        6,
        {"material": "atlas"},
    ),
    (
        "Erkaklar jinsi shim",
        "To'q ko'k slim fit",
        295_000,
        0,
        1,
        3,
        "Chakana",
        1,
        {"material": "denim", "color": "ko'k"},
    ),
    (
        "Erkak klassik kostyum kurtka",
        "Ko'k rang klassik kostyum — rasm qidiruv demo",
        1_250_000,
        0,
        1,
        3,
        "Chakana",
        1,
        {"material": "paxta-aralash", "color": "ko'k"},
    ),
    (
        "Erkak charm kamar",
        "Jigarrang klassik kamar",
        85_000,
        4,
        0,
        2,
        "Chakana",
        1,
        {"material": "charm", "color": "jigarrang"},
    ),
    (
        "Ulgurji erkaklar ko'ylak seriyasi",
        "12 dona, turli o'lcham",
        1_680_000,
        0,
        1,
        3,
        "Optom",
        12,
        {"material": "paxta"},
    ),
]

# Mahsulot nomi bo'yicha mos rasm — scripts/catalog_images.py
_scripts_dir = os.path.abspath(os.path.dirname(__file__))
if _scripts_dir not in sys.path:
    sys.path.insert(0, _scripts_dir)
from catalog_images import pick_catalog_image as pick_product_image  # noqa: E402


def make_product_embedding(name: str, desc: str, attrs: dict) -> list[float]:
    """Same deterministic vectors as EmbeddingClient when OPENAI_API_KEY is unset."""
    parts = [
        name,
        desc,
        str(attrs.get("root_category") or ""),
        str(attrs.get("sub_category") or ""),
        str(attrs.get("category") or ""),
        str(attrs.get("material") or ""),
        str(attrs.get("color") or ""),
    ]
    return _deterministic_embed(" ".join(p for p in parts if p).strip())


async def seed() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionFactory() as db:
        count = await db.scalar(select(func.count(IpadromModel.id)))
        if count and count > 0 and not FORCE_RESEED:
            print("⚠️  Ma'lumotlar mavjud. Tozalash: FORCE_RESEED=1 python scripts/seed.py")
            return

        if FORCE_RESEED and count and count > 0:
            product_ids = select(ProductModel.id)
            await db.execute(delete(LeadModel).where(LeadModel.product_id.in_(product_ids)))
            await db.execute(delete(OrderModel).where(OrderModel.product_id.in_(product_ids)))
            await db.execute(delete(TrackingEventModel).where(TrackingEventModel.product_id.in_(product_ids)))
            await db.execute(
                MerchantPendingProductModel.__table__.update()
                .where(MerchantPendingProductModel.published_product_id.in_(product_ids))
                .values(published_product_id=None)
            )
            await db.execute(delete(ProductModel))
            await db.execute(delete(LeadModel))
            await db.execute(delete(OrderModel))
            await db.execute(delete(TrackingEventModel))
            await db.execute(delete(ShopModel))
            await db.execute(delete(CategoryModel))
            await db.execute(delete(IpadromModel))
            await db.commit()
            print("  🔄 FORCE_RESEED: jadvalar tozalandi.")

        ipadrom_ids: list[uuid.UUID] = []
        for data in IPADROMS:
            row = IpadromModel(**data)
            db.add(row)
            await db.flush()
            ipadrom_ids.append(row.id)
            print(f"  ✅ Bozor hududi: {data['name']}")

        root_ids: list[uuid.UUID] = []
        sub_ids: list[list[uuid.UUID]] = []
        for root in CATEGORY_TREE:
            root_row = CategoryModel(
                name=root["name"],
                icon=root.get("icon"),
                sort_order=root["sort_order"],
            )
            db.add(root_row)
            await db.flush()
            root_ids.append(root_row.id)
            subs: list[uuid.UUID] = []
            for sub_name in root["subs"]:
                sub_row = CategoryModel(
                    name=sub_name,
                    parent_id=root_row.id,
                    sort_order=root["sort_order"],
                )
                db.add(sub_row)
                await db.flush()
                subs.append(sub_row.id)
            sub_ids.append(subs)
            print(f"  ✅ Kategoriya: {root['name']} ({len(subs)} ta sub)")

        shop_ids: list[uuid.UUID] = []
        used_slugs: set[str] = set()
        for i, data in enumerate(SHOPS):
            base_slug = slugify(data["name"])
            slug = base_slug if base_slug not in used_slugs else f"{base_slug}-{i + 1}"
            used_slugs.add(slug)
            shop = ShopModel(
                owner_phone=data["owner_phone"],
                owner_email=data["owner_email"],
                name=data["name"],
                description=data["description"],
                floor=data["floor"],
                section=data["section"],
                slug=slug,
                ipadrom_id=ipadrom_ids[data["ipadrom_index"]],
                market_zone=data["market_zone"],
                block_sector=data["block_sector"],
                location_comment=data["location_label"],
                is_verified=True,
                is_featured=i < 4,
                is_active=True,
            )
            spatial = parse_shop_spatial(shop)
            map_x, map_y = stall_map_point(spatial["block_id"], spatial["stall_number"])
            shop.latitude, shop.longitude = indoor_pixel_to_wgs84(map_x, map_y)
            db.add(shop)
            await db.flush()
            shop_ids.append(shop.id)
            print(f"  ✅ Do'kon: {data['name']} — {data['location_label']}")

        for row in PRODUCTS:
            name, desc, price, root_i, sub_i, shop_i, sale_type, min_qty, extra = row
            shop_meta = SHOPS[shop_i]
            root_name = CATEGORY_TREE[root_i]["name"]
            sub_name = CATEGORY_TREE[root_i]["subs"][sub_i]
            product = ProductModel(
                shop_id=shop_ids[shop_i],
                category_id=sub_ids[root_i][sub_i],
                name=name,
                description=desc,
                price=price,
                sale_type=sale_type,
                min_order_quantity=min_qty,
                images=[pick_product_image(name, desc)],
                attributes={
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
                },
                embedding=make_product_embedding(
                    name,
                    desc,
                    {
                        **extra,
                        "root_category": root_name,
                        "sub_category": sub_name,
                        "category": sub_name,
                    },
                ),
                is_available=True,
                is_featured=random.choice([True, False, False]),
                view_count=random.randint(40, 1200),
            )
            db.add(product)
            print(f"  ✅ [{sale_type}] {name}")

        await db.commit()
        print(
            f"\n🎉 Mega-bazaar seed tayyor! {len(IPADROMS)} hudud, "
            f"{sum(len(c['subs']) for c in CATEGORY_TREE)} sub-kategoriya, "
            f"{len(SHOPS)} do'kon, {len(PRODUCTS)} mahsulot."
        )


if __name__ == "__main__":
    asyncio.run(seed())
