"""
Mock Reels seed — demo video larni DB ga yozish.
Ishlatish:
  docker compose exec backend python /app/scripts/seed_reels.py
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


def _bootstrap() -> None:
    here = os.path.abspath(os.path.dirname(__file__))
    for candidate in (os.path.join(here, "..", "backend"), os.path.join(here, "..")):
        if os.path.isdir(os.path.join(candidate, "app")):
            sys.path.insert(0, candidate)
            return
    raise RuntimeError("backend app not found")


_bootstrap()

from app.core.config import get_settings
from app.infrastructure.db.models import ShopModel, ProductModel
from app.models.reels import ReelsVideoModel

settings = get_settings()
engine = create_async_engine(settings.async_database_url, echo=False)
SessionFactory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

# ─── Public demo video URLs (royalty-free, landscape adapted) ─────
# Bular Pexels/Pixabay public domain short clips
DEMO_VIDEOS = [
    {
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-young-woman-choosing-clothes-in-a-store-41845-large.mp4",
        "thumbnail_url": "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&q=80",
        "caption": "Yangi bahor kolleksiyasi keldi! 🌸 Ippodrom do'konimizda hamma narsa bor",
        "hashtags": ["bahor", "moda", "Ippodrom", "kiyim", "yangi"],
        "category_tags": ["fashion"],
        "shop_index": 0,   # Anor Boutique
        "views": 1247, "likes": 89, "shares": 23,
    },
    {
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-woman-trying-on-clothes-in-a-fitting-room-41843-large.mp4",
        "thumbnail_url": "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&q=80",
        "caption": "Sarpo yoki kechki libos? Biz ikkalasini ham taklif qilamiz 👗✨",
        "hashtags": ["sarpo", "kechki", "libos", "do'kon", "Ippodrom"],
        "category_tags": ["fashion"],
        "shop_index": 0,   # Anor Boutique
        "views": 892, "likes": 67, "shares": 15,
    },
    {
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-man-selecting-clothes-in-a-clothing-store-41846-large.mp4",
        "thumbnail_url": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&q=80",
        "caption": "Sport majmua — arzon, sifatli! Abu Sahiydan bepul yetkazib beramiz 🏃‍♂️",
        "hashtags": ["sport", "erkak", "kiyim", "AbuSahiy", "arzon"],
        "category_tags": ["sport"],
        "shop_index": 5,   # Sport Line Ippodrom
        "views": 2341, "likes": 198, "shares": 44,
    },
    {
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-woman-spraying-perfume-on-her-neck-2773-large.mp4",
        "thumbnail_url": "https://images.unsplash.com/photo-1541643600914-78b084683702?w=400&q=80",
        "caption": "Dubay Lattafa optom! Barcha hidlar bor 🌹 Minimal 12 dona",
        "hashtags": ["atir", "Lattafa", "Dubay", "optom", "parfyum"],
        "category_tags": ["beauty"],
        "shop_index": 1,   # Dubai Atir Optom
        "views": 3102, "likes": 256, "shares": 78,
    },
    {
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-woman-putting-on-white-sneakers-42445-large.mp4",
        "thumbnail_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80",
        "caption": "Turkiya charm tufli — klassik dizayn, haqiqiy charm 👞 Faqat 890k",
        "hashtags": ["poyabzal", "tufli", "Turkiya", "charm", "erkak"],
        "category_tags": ["shoes"],
        "shop_index": 2,   # Turkiya Premium Poyabzal
        "views": 1567, "likes": 123, "shares": 31,
    },
    {
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-woman-modeling-a-casual-outfit-in-a-park-42048-large.mp4",
        "thumbnail_url": "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80",
        "caption": "Bahoriy yengil kurtka — har narsaga yopishadi 🌿 Ippodromda 395k",
        "hashtags": ["kurtka", "bahor", "casual", "look", "style"],
        "category_tags": ["fashion"],
        "shop_index": 5,   # Sport Line Ippodrom
        "views": 1890, "likes": 145, "shares": 38,
    },
    {
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-young-woman-trying-a-stylish-outfit-in-a-store-39798-large.mp4",
        "thumbnail_url": "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&q=80",
        "caption": "Kozgalovkadan optom partiya! 12 ta dan buyurtma qiling, chegirma tayyorlab qo'yamiz",
        "hashtags": ["optom", "Kozgalovka", "wholesale", "partiya", "chegirma"],
        "category_tags": ["fashion", "wholesale"],
        "shop_index": 3,   # Kozgalovka Optom Fashion
        "views": 4521, "likes": 312, "shares": 92,
    },
    {
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-woman-and-man-walk-through-a-shopping-center-41848-large.mp4",
        "thumbnail_url": "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80",
        "caption": "Topdim.UZ — Ippodrom bozorini telefonda toping 📱 #Reklama",
        "hashtags": ["Topdim", "Ippodrom", "bozor", "qidiruv", "AI"],
        "category_tags": ["fashion"],
        "shop_index": 0,   # Anor Boutique
        "views": 5234, "likes": 421, "shares": 134,
    },
]


async def seed_reels() -> None:
    async with SessionFactory() as db:
        # Mavjud reels ni tekshirish
        existing = await db.execute(select(ReelsVideoModel).limit(1))
        if existing.scalars().first():
            print("⚠️  Reels allaqachon mavjud. FORCE_RESEED=1 bo'lmasa o'tkazib yuboradi.")
            if not os.getenv("FORCE_RESEED", "").lower() in {"1", "true"}:
                return
            # Tozalash
            from sqlalchemy import delete
            await db.execute(delete(ReelsVideoModel))
            await db.commit()

        # Do'konlar va mahsulotlarni olish
        shops_result = await db.execute(select(ShopModel).where(ShopModel.is_verified == True))
        shops = list(shops_result.scalars().all())
        if not shops:
            print("❌ Do'konlar topilmadi — avval seed.py ni ishga tushiring")
            return

        products_result = await db.execute(select(ProductModel).limit(20))
        products = list(products_result.scalars().all())

        now = datetime.now(timezone.utc)

        for i, v in enumerate(DEMO_VIDEOS):
            shop_idx = v["shop_index"]
            if shop_idx >= len(shops):
                shop_idx = i % len(shops)
            shop = shops[shop_idx]

            # Mahsulot tagging — shu do'konning mahsulotlarini ul
            shop_products = [p for p in products if p.shop_id == shop.id]
            tagged_ids = [str(p.id) for p in shop_products[:2]]

            # Score hisoblash
            from app.application.reels.feed_algorithm import compute_video_score
            fake_video = type("V", (), {
                "views_count": v["views"],
                "likes_count": v["likes"],
                "shares_count": v["shares"],
                "saves_count": 0,
                "created_at": now - timedelta(hours=i * 3),
            })()
            score = compute_video_score(fake_video)

            reel = ReelsVideoModel(
                id=uuid.uuid4(),
                shop_id=shop.id,
                video_url=v["video_url"],
                thumbnail_url=v.get("thumbnail_url"),
                duration_seconds=15.0 + i * 2,
                aspect_ratio="9:16",
                caption=v["caption"],
                hashtags=v["hashtags"],
                tagged_product_ids=tagged_ids,
                category_tags=v["category_tags"],
                views_count=v["views"],
                likes_count=v["likes"],
                shares_count=v["shares"],
                saves_count=v.get("saves", 5),
                comments_count=0,
                algorithm_score=score,
                status="active",
                is_active=True,
            )
            reel.created_at = now - timedelta(hours=i * 4)
            db.add(reel)
            print(f"  ✅ Reel [{shop.name}]: {v['caption'][:60]}...")

        await db.commit()
        print(f"\n🎬 {len(DEMO_VIDEOS)} ta demo reel yuklandi!")
        print("   /reels sahifasida ko'rish mumkin")


if __name__ == "__main__":
    asyncio.run(seed_reels())
