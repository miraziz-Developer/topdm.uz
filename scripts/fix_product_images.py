"""
Butun bazada mahsulot rasmini nomiga / kategoriyasiga moslashtirish.

Ishlatish:
  docker compose exec backend python /app/scripts/fix_product_images.py
  docker compose exec backend python /app/scripts/fix_product_images.py --reembed
  docker compose exec backend python /app/scripts/fix_product_images.py --all
"""
from __future__ import annotations

import argparse
import asyncio
import os
import subprocess
import sys

from sqlalchemy import select


def _bootstrap_import_path() -> None:
    here = os.path.abspath(os.path.dirname(__file__))
    for candidate in (os.path.join(here, "..", "backend"), os.path.join(here, "..")):
        if os.path.isdir(os.path.join(candidate, "app")):
            sys.path.insert(0, candidate)
            return
    raise RuntimeError("Could not locate backend app package")


_bootstrap_import_path()

_scripts_dir = os.path.abspath(os.path.dirname(__file__))
if _scripts_dir not in sys.path:
    sys.path.insert(0, _scripts_dir)

from app.core.config import get_settings
from app.infrastructure.db.models import ProductModel
from app.infrastructure.db.session import AsyncSessionFactory
from catalog_images import is_seed_placeholder_image, pick_catalog_image, resolve_pool_key


async def main(*, reembed: bool, only_placeholders: bool) -> None:
    updated = 0
    skipped_merchant = 0
    async with AsyncSessionFactory() as db:
        result = await db.execute(select(ProductModel))
        products = result.scalars().all()
        for product in products:
            attrs = dict(product.attributes or {})
            current = (product.images or [""])[0] if product.images else ""
            if only_placeholders and current and not is_seed_placeholder_image(current):
                skipped_merchant += 1
                continue

            url = pick_catalog_image(
                product.name,
                product.description or "",
                attrs,
            )
            slot = resolve_pool_key(product.name, product.description or "", attrs)
            changed = False
            if current != url:
                product.images = [url]
                changed = True
            if attrs.get("catalog_slot") != slot:
                attrs["catalog_slot"] = slot
                product.attributes = attrs
                changed = True
            if not changed:
                continue
            updated += 1
            print(f"  [{slot:8}] {product.name[:72]}")

        await db.commit()

    print(f"\n✅ {updated} ta mahsulot rasmi nomiga moslashtirildi.")
    if skipped_merchant:
        print(f"   (sotuvchi rasmlari saqlab qolindi: {skipped_merchant})")

    if reembed and updated > 0:
        print("\n🔄 Vizual indeks qayta yaratilmoqda (GOOGLE_API_KEY)…")
        script = os.path.join(_scripts_dir, "reembed_products.py")
        subprocess.run([sys.executable, script], check=True)
        print("✅ Indeks tayyor.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Nom ↔ rasm moslashtirish")
    parser.add_argument(
        "--reembed",
        action="store_true",
        help="Rasmlardan keyin visual_embedding yangilash",
    )
    parser.add_argument(
        "--seed-only",
        action="store_true",
        help="Faqat Unsplash/seed rasmlarini yangilash (sotuvchi yuklaganlarini tegmaydi)",
    )
    args = parser.parse_args()
    get_settings()
    asyncio.run(main(reembed=args.reembed, only_placeholders=args.seed_only))
