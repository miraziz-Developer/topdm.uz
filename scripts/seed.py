"""
Bozor AI — Seed script
Ipadromlar, kategoriyalar, test do'konlar va tovarlar yaratadi.
Ishlatish: python scripts/seed.py
"""
import asyncio
import uuid
import random

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.core.config import get_settings
from app.infrastructure.db.base import Base
from app.infrastructure.db.models import (
    IpadromModel, CategoryModel, ShopModel, ProductModel,
)

settings = get_settings()

engine = create_async_engine(settings.async_database_url, echo=False)
SessionFactory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

IPADROMS = [
    {"name": "Yunusobod ipadrom", "city": "Toshkent", "address": "Yunusobod tumani, Amir Temur ko'chasi", "lat": 41.3385, "lng": 69.2855},
    {"name": "Olmazor ipadrom", "city": "Toshkent", "address": "Olmazor tumani", "lat": 41.3450, "lng": 69.2200},
    {"name": "Chorsu bozor", "city": "Toshkent", "address": "Eski shahar, Chorsu metro yonida", "lat": 41.3265, "lng": 69.2345},
    {"name": "Turkiston bozori", "city": "Toshkent", "address": "Sergeli tumani", "lat": 41.2400, "lng": 69.2100},
    {"name": "Ipodrom bozori", "city": "Toshkent", "address": "Shayxontohur tumani", "lat": 41.3100, "lng": 69.2600},
]

CATEGORIES = [
    {"name": "Kiyim", "name_ru": "Одежда", "icon": "👔", "sort_order": 1},
    {"name": "Elektronika", "name_ru": "Электроника", "icon": "📱", "sort_order": 2},
    {"name": "Kosmetika", "name_ru": "Косметика", "icon": "💄", "sort_order": 3},
    {"name": "Oziq-ovqat", "name_ru": "Продукты", "icon": "🥗", "sort_order": 4},
    {"name": "Uy jihozlari", "name_ru": "Мебель", "icon": "🛋️", "sort_order": 5},
    {"name": "Sport", "name_ru": "Спорт", "icon": "⚽", "sort_order": 6},
    {"name": "Bolalar", "name_ru": "Детские", "icon": "🧸", "sort_order": 7},
    {"name": "Aksesuar", "name_ru": "Аксессуары", "icon": "💍", "sort_order": 8},
]

SHOPS = [
    {"owner_phone": "+998901234567", "name": "Samandar Fashion", "description": "Premium kiyimlar do'koni", "floor": "2-qavat", "section": "14-do'kon"},
    {"owner_phone": "+998901234568", "name": "TechWorld UZ", "description": "Eng yangi gadgetlar va aksessuarlar", "floor": "1-qavat", "section": "5-do'kon"},
]

PRODUCTS_KIYIM = [
    {"name": "Qora charm kurtka", "description": "Premium teri kurtkasi, L/XL o'lcham", "price": 850000},
    {"name": "Oq ko'ylak (klassik)", "description": "100% paxta, ofis uchun ideal", "price": 185000},
    {"name": "Erkaklar jinsi shim", "description": "Slim fit, to'q ko'k rang", "price": 280000},
    {"name": "Ayollar palto", "description": "Qishki issiq palto, bej rang", "price": 1200000},
    {"name": "Bolalar krossovka", "description": "Sport poyabzal 28-35 o'lcham", "price": 220000},
    {"name": "Qishki shapka (jun)", "description": "Tabiiy jun, qora rang", "price": 95000},
    {"name": "Sport kostyum (erkaklar)", "description": "Nike uslubida, qora/oq", "price": 380000},
    {"name": "Yozgi ko'ylak (ayollar)", "description": "Yengil mato, gullangan", "price": 165000},
    {"name": "Charm belbog'", "description": "Italyancha stil, universal o'lcham", "price": 120000},
    {"name": "Klassik kostyum", "description": "To'y va tadbirlar uchun, to'q ko'k", "price": 950000},
]

PRODUCTS_TECH = [
    {"name": "iPhone 15 Pro Max 256GB", "description": "Yangi, kafolat bilan", "price": 16500000},
    {"name": "Samsung Galaxy S24", "description": "Qora rang, 128GB", "price": 11200000},
    {"name": "AirPods Pro 2", "description": "Asl, shovqin bekor qilish", "price": 2800000},
    {"name": "MacBook Air M2", "description": "8GB/256GB, Midnight", "price": 14500000},
    {"name": "Xiaomi Redmi Note 13", "description": "6/128GB, yashil rang", "price": 2400000},
    {"name": "JBL Flip 6 kolonka", "description": "Suvo'tmas, ko'k rang", "price": 850000},
    {"name": "Apple Watch SE", "description": "40mm, GPS, qora", "price": 3200000},
    {"name": "Samsung Galaxy Tab A9", "description": "64GB, Wi-Fi", "price": 2100000},
    {"name": "Baseus powerbank 20000mAh", "description": "Tez quvvatlash, oq rang", "price": 280000},
    {"name": "Lenovo ThinkPad X1", "description": "i7/16GB/512GB SSD", "price": 18500000},
]


def make_dummy_embedding() -> list[float]:
    """Random 1536-dimensional embedding for seed data."""
    return [random.uniform(-1.0, 1.0) for _ in range(1536)]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionFactory() as db:
        # Check if already seeded
        from sqlalchemy import select, func
        count = await db.scalar(select(func.count(IpadromModel.id)))
        if count and count > 0:
            print("⚠️  Ma'lumotlar allaqachon mavjud. O'tkazib yuborildi.")
            return

        # 1. Ipadroms
        ipadrom_ids = []
        for data in IPADROMS:
            ipadrom = IpadromModel(**data)
            db.add(ipadrom)
            await db.flush()
            ipadrom_ids.append(ipadrom.id)
            print(f"  ✅ Ipadrom: {data['name']}")

        # 2. Categories
        cat_ids = []
        for data in CATEGORIES:
            cat = CategoryModel(**data)
            db.add(cat)
            await db.flush()
            cat_ids.append(cat.id)
            print(f"  ✅ Kategoriya: {data['name']}")

        # 3. Shops
        shop_ids = []
        for i, data in enumerate(SHOPS):
            shop = ShopModel(
                **data,
                ipadrom_id=ipadrom_ids[i % len(ipadrom_ids)],
                is_verified=True,
                is_active=True,
            )
            db.add(shop)
            await db.flush()
            shop_ids.append(shop.id)
            print(f"  ✅ Do'kon: {data['name']}")

        # 4. Products
        for prod_data in PRODUCTS_KIYIM:
            product = ProductModel(
                shop_id=shop_ids[0],
                category_id=cat_ids[0],  # Kiyim
                name=prod_data["name"],
                description=prod_data["description"],
                price=prod_data["price"],
                images=[f"https://picsum.photos/seed/{uuid.uuid4().hex[:8]}/400/400"],
                attributes={"color": "qora", "size": ["S", "M", "L", "XL"]},
                embedding=make_dummy_embedding(),
                is_available=True,
                is_featured=random.choice([True, False]),
                view_count=random.randint(10, 500),
            )
            db.add(product)
            print(f"  ✅ Tovar: {prod_data['name']}")

        for prod_data in PRODUCTS_TECH:
            product = ProductModel(
                shop_id=shop_ids[1],
                category_id=cat_ids[1],  # Elektronika
                name=prod_data["name"],
                description=prod_data["description"],
                price=prod_data["price"],
                images=[f"https://picsum.photos/seed/{uuid.uuid4().hex[:8]}/400/400"],
                attributes={"brand": "Premium", "warranty": "1 yil"},
                embedding=make_dummy_embedding(),
                is_available=True,
                is_featured=random.choice([True, False]),
                view_count=random.randint(10, 500),
            )
            db.add(product)
            print(f"  ✅ Tovar: {prod_data['name']}")

        await db.commit()
        print(f"\n🎉 Seed tayyor! {len(IPADROMS)} ipadrom, {len(CATEGORIES)} kategoriya, {len(SHOPS)} do'kon, {len(PRODUCTS_KIYIM) + len(PRODUCTS_TECH)} tovar yaratildi.")


if __name__ == "__main__":
    asyncio.run(seed())
