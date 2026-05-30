#!/usr/bin/env python3
"""HTTP audit — product image URLs in DB (broken / placeholder stats)."""
from __future__ import annotations

import asyncio
import os
import sys

import httpx
from sqlalchemy import select


def _bootstrap() -> None:
    here = os.path.abspath(os.path.dirname(__file__))
    for candidate in (os.path.join(here, "..", "backend"), os.path.join(here, "..")):
        if os.path.isdir(os.path.join(candidate, "app")):
            sys.path.insert(0, candidate)
            return
    raise RuntimeError("backend app not found")


_bootstrap()
_scripts = os.path.abspath(os.path.dirname(__file__))
if _scripts not in sys.path:
    sys.path.insert(0, _scripts)

from app.infrastructure.db.models import ProductModel
from app.infrastructure.db.session import AsyncSessionFactory
from catalog_images import is_seed_placeholder_image


async def _check_url(client: httpx.AsyncClient, url: str) -> tuple[int, str]:
    try:
        r = await client.head(url)
        if r.status_code == 405:
            r = await client.get(url)
        return r.status_code, ""
    except Exception as exc:
        return 0, str(exc)[:120]


async def main() -> None:
    broken: list[tuple[str, str, int, str]] = []
    placeholders = 0
    merchant_cdn = 0
    total = 0

    async with AsyncSessionFactory() as db:
        rows = (await db.execute(select(ProductModel))).scalars().all()

    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        for p in rows:
            url = (p.images or [""])[0] if p.images else ""
            if not url.strip():
                broken.append((str(p.id), p.name[:60], 0, "empty"))
                total += 1
                continue
            total += 1
            if is_seed_placeholder_image(url):
                placeholders += 1
            elif "picsum" not in url and "/api/v1/media/" not in url:
                merchant_cdn += 1

            code, err = await _check_url(client, url)
            if code >= 400 or code == 0:
                broken.append((str(p.id), p.name[:60], code, err or "http_error"))

    print(f"Mahsulotlar: {total}")
    print(f"  Placeholder/seed: {placeholders}")
    print(f"  Haqiqiy/CDN (taxmin): {merchant_cdn}")
    print(f"  Buzilgan URL: {len(broken)}")

    for pid, name, code, err in broken[:25]:
        print(f"  [{code}] {name} — {pid} — {err}")
    if len(broken) > 25:
        print(f"  ... +{len(broken) - 25} ta")

    if broken:
        sys.exit(1)
    print("OK  barcha URL lar javob berdi")


if __name__ == "__main__":
    asyncio.run(main())
