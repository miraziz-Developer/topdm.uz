#!/usr/bin/env python3
"""Published mahsulot rasmlarini Telegram file_id dan qayta yuklash (404 tuzatish)."""
from __future__ import annotations

import asyncio
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from sqlalchemy import select

from app.infrastructure.db.models import MerchantPendingProductModel, ProductModel
from app.infrastructure.db.session import AsyncSessionFactory
from app.infrastructure.storage.telegram_media import TelegramMediaStore


def _collect_file_ids(attrs: dict) -> list[str]:
    ids: list[str] = []
    seen: set[str] = set()
    draft = attrs.get("variant_draft") if isinstance(attrs.get("variant_draft"), dict) else {}
    for row in draft.get("colors") or []:
        if not isinstance(row, dict):
            continue
        for fid in row.get("telegram_file_ids") or []:
            s = str(fid).strip()
            if s and s not in seen:
                seen.add(s)
                ids.append(s)
    fallback = str(attrs.get("telegram_file_id") or "").strip()
    if fallback and fallback not in seen:
        ids.insert(0, fallback)
    return ids


async def rehydrate(*, product_id: str | None = None, all_published: bool = False) -> None:
    media = TelegramMediaStore()
    async with AsyncSessionFactory() as session:
        if product_id:
            pending_rows = (
                await session.execute(
                    select(MerchantPendingProductModel).where(
                        MerchantPendingProductModel.published_product_id == uuid.UUID(product_id)
                    )
                )
            ).scalars().all()
        elif all_published:
            pending_rows = (
                await session.execute(
                    select(MerchantPendingProductModel).where(
                        MerchantPendingProductModel.status == "published",
                        MerchantPendingProductModel.published_product_id.is_not(None),
                    )
                )
            ).scalars().all()
        else:
            print("product_id yoki --all kerak")
            return

        fixed = 0
        for pending in pending_rows:
            if not pending.published_product_id:
                continue
            product = await session.get(ProductModel, pending.published_product_id)
            if not product:
                continue
            attrs = dict(pending.vision_attributes or {})
            file_ids = _collect_file_ids(attrs)
            if not file_ids:
                print(f"skip {product.id}: telegram file_id yo'q")
                continue
            urls: list[str] = []
            for fid in file_ids:
                url = await media.resolve_permanent_url(
                    shop_id=product.shop_id,
                    telegram_file_id=fid,
                )
                urls.append(url)
            if not urls:
                continue
            product.images = urls
            fixed += 1
            print(f"ok {product.name} ({product.id}) -> {len(urls)} rasm")
        await session.commit()
        print(f"Tayyor: {fixed} mahsulot yangilandi")


if __name__ == "__main__":
    pid = None
    all_flag = "--all" in sys.argv
    for arg in sys.argv[1:]:
        if arg != "--all":
            pid = arg
    asyncio.run(rehydrate(product_id=pid, all_published=all_flag))
