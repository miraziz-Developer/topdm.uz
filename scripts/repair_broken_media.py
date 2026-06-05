#!/usr/bin/env python3
"""Buzuk mahalliy media: reel poster (shop logo) va yo'q fayllarni belgilash."""
from __future__ import annotations

import asyncio
import os
import sys


def _bootstrap() -> None:
    here = os.path.abspath(os.path.dirname(__file__))
    for candidate in (os.path.join(here, "..", "backend"), os.path.join(here, "..")):
        if os.path.isdir(os.path.join(candidate, "app")):
            sys.path.insert(0, candidate)
            return
    raise RuntimeError("backend app package not found")


_bootstrap()

from sqlalchemy import select

from app.application.media.media_availability import media_file_exists
from app.infrastructure.db.models import ShopModel
from app.infrastructure.db.session import AsyncSessionFactory
from app.models.reels import ReelsVideoModel


async def main() -> None:
    fixed_thumb = 0
    deactivated = 0
    async with AsyncSessionFactory() as db:
        result = await db.execute(
            select(ReelsVideoModel).where(ReelsVideoModel.is_active.is_(True))
        )
        for video in result.scalars().all():
            shop = await db.get(ShopModel, video.shop_id)
            if not media_file_exists(video.video_url):
                video.is_active = False
                video.status = "media_missing"
                deactivated += 1
                continue
            if not (video.thumbnail_url or "").strip():
                logo = (shop.logo_url or "").strip() if shop else ""
                if logo:
                    video.thumbnail_url = logo
                    fixed_thumb += 1
        await db.commit()
    print(f"reels_deactivated_missing_video={deactivated}")
    print(f"reels_thumbnail_from_logo={fixed_thumb}")


if __name__ == "__main__":
    asyncio.run(main())
