#!/usr/bin/env python3
"""
Local uploads/products → S3 va DB URL yangilash.

  docker compose exec backend python /app/scripts/migrate_local_uploads_to_s3.py --dry-run
  docker compose exec backend python /app/scripts/migrate_local_uploads_to_s3.py
"""
from __future__ import annotations

import argparse
import asyncio
import mimetypes
import os
import re
import sys
from pathlib import Path
from uuid import UUID

from sqlalchemy import select


def _bootstrap() -> None:
    here = os.path.abspath(os.path.dirname(__file__))
    for candidate in (os.path.join(here, "..", "backend"), os.path.join(here, "..")):
        if os.path.isdir(os.path.join(candidate, "app")):
            sys.path.insert(0, candidate)
            return
    raise RuntimeError("backend app not found")


_bootstrap()

from app.core.config import get_settings
from app.infrastructure.db.models import ProductModel
from app.infrastructure.db.session import AsyncSessionFactory
from app.infrastructure.storage.object_store import ObjectMediaStore

_LOCAL_MEDIA_RE = re.compile(
    r"/api/v1/media/products/([0-9a-f-]{36})/([0-9a-f-]{36}\.[a-z0-9]+)$",
    re.I,
)


async def main(*, dry_run: bool) -> None:
    settings = get_settings()
    store = ObjectMediaStore(settings)
    if store.backend != "s3":
        print(f"FAIL: MEDIA_STORAGE_BACKEND={store.backend} — s3 qilib qayta ishga tushiring")
        sys.exit(1)

    uploads_root = Path(__file__).resolve().parents[1] / "backend" / "uploads" / "products"
    if not uploads_root.is_dir():
        uploads_root = Path("/app/uploads/products")

    migrated = 0
    skipped = 0

    async with AsyncSessionFactory() as db:
        products = (await db.execute(select(ProductModel))).scalars().all()
        for product in products:
            current = (product.images or [""])[0] if product.images else ""
            m = _LOCAL_MEDIA_RE.search(current)
            if not m:
                skipped += 1
                continue
            shop_id = UUID(m.group(1))
            filename = m.group(2)
            local_path = uploads_root / str(shop_id) / filename
            if not local_path.is_file():
                print(f"  SKIP missing file: {local_path}")
                continue

            ext = local_path.suffix.lstrip(".") or "jpg"
            content_type = mimetypes.guess_type(local_path.name)[0] or "image/jpeg"
            data = local_path.read_bytes()

            if dry_run:
                print(f"  DRY {product.name[:50]} → s3 ({len(data)} bytes)")
                migrated += 1
                continue

            new_url = await store.save_product_image(
                shop_id=shop_id,
                image_bytes=data,
                extension=ext,
                content_type=content_type,
            )
            product.images = [new_url]
            migrated += 1
            print(f"  OK {product.name[:50]}")

        if not dry_run:
            await db.commit()

    print(f"\n{'DRY ' if dry_run else ''}Migratsiya: {migrated}, o'tkazildi: {skipped}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(main(dry_run=args.dry_run))
