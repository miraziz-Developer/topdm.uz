#!/usr/bin/env python3
"""S3/Supabase media storage smoke test — upload + public HEAD."""
from __future__ import annotations

import asyncio
import os
import sys
import uuid

import httpx


def _bootstrap() -> None:
    here = os.path.abspath(os.path.dirname(__file__))
    for candidate in (os.path.join(here, "..", "backend"), os.path.join(here, "..")):
        if os.path.isdir(os.path.join(candidate, "app")):
            sys.path.insert(0, candidate)
            return
    raise RuntimeError("backend app not found")


_bootstrap()

from app.core.config import get_settings
from app.infrastructure.storage.object_store import ObjectMediaStore

# 1x1 JPEG
_TINY_JPEG = bytes.fromhex(
    "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707"
    "070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c"
    "2837292c30313434341f27393d38323c2e333432ffdb0043010909090c0b0c180d0d"
    "1832211c213232323232323232323232323232323232323232323232323232323232"
    "323232323232323232ffc00011080001000103011100021100031100ffc400140001"
    "00000000000000000000000000000008ffc400141001000000000000000000000000"
    "00000000ffda000c03010002110311003f00bfd7ffd9"
)


async def main() -> None:
    settings = get_settings()
    store = ObjectMediaStore(settings)
    backend = store.backend
    print(f"Backend: {backend}")

    if backend == "local":
        print("WARN: MEDIA_STORAGE_BACKEND=local — production uchun s3 qo'ying")
        shop_id = uuid.uuid4()
        url = await store.save_product_image(
            shop_id=shop_id,
            image_bytes=_TINY_JPEG,
            extension="jpg",
            content_type="image/jpeg",
        )
        print(f"OK  local URL: {url}")
        return

    shop_id = uuid.uuid4()
    url = await store.save_product_image(
        shop_id=shop_id,
        image_bytes=_TINY_JPEG,
        extension="jpg",
        content_type="image/jpeg",
    )
    print(f"Upload URL: {url}")

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        resp = await client.head(url)
        if resp.status_code >= 400:
            resp = await client.get(url)
        resp.raise_for_status()

    print("OK  public URL reachable (HEAD/GET)")
    if backend == "s3" and not (settings.s3_public_base_url or "").strip():
        print("WARN: S3_PUBLIC_BASE_URL bo'sh — CDN custom domain qo'shing")


if __name__ == "__main__":
    asyncio.run(main())
