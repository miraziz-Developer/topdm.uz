#!/usr/bin/env python3
"""Production katalog tuzatish: tasdiqlangan do'konlar + embedding backfill.

Ishlatish (server):
  docker exec bozorliii-backend-1 python /app/scripts/ensure_production_catalog.py
"""
from __future__ import annotations

import asyncio
import os
import sys


def _bootstrap_import_path() -> None:
    here = os.path.abspath(os.path.dirname(__file__))
    for candidate in (os.path.join(here, "..", "backend"), os.path.join(here, "..")):
        if os.path.isdir(os.path.join(candidate, "app")):
            sys.path.insert(0, candidate)
            return
    raise RuntimeError("Could not locate backend app package")


_bootstrap_import_path()

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.infrastructure.ai_clients.embedding import EmbeddingClient, _deterministic_embed
from app.infrastructure.db.models import ProductModel, ShopModel


async def main() -> int:
    settings = get_settings()
    engine = create_async_engine(settings.async_database_url, echo=False)
    Session = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    embedder = EmbeddingClient()

    verified = 0
    embedded = 0

    async with Session() as session:
        shop_ids = (
            await session.execute(
                select(ProductModel.shop_id)
                .where(ProductModel.is_available.is_(True))
                .distinct()
            )
        ).scalars().all()
        if shop_ids:
            result = await session.execute(
                update(ShopModel)
                .where(
                    ShopModel.id.in_(shop_ids),
                    ShopModel.is_active.is_(True),
                    ShopModel.is_blocked.is_(False),
                    ShopModel.is_verified.is_(False),
                )
                .values(is_verified=True)
            )
            verified = int(result.rowcount or 0)

        missing = (
            await session.execute(
                select(ProductModel)
                .where(ProductModel.is_available.is_(True), ProductModel.embedding.is_(None))
                .limit(200)
            )
        ).scalars().all()
        for product in missing:
            text = f"{product.name} {product.description or ''}".strip()
            try:
                vector = await embedder.embed(text)
            except Exception:
                vector = _deterministic_embed(text)
            product.embedding = vector
            embedded += 1

        await session.commit()

    print(f"ensure_production_catalog: verified_shops={verified} embeddings_backfilled={embedded}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
