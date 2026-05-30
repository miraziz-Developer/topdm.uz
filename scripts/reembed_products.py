"""
Rebuild product embeddings from title + description + category metadata.
Run: docker compose exec backend python /app/scripts/reembed_products.py
"""
from __future__ import annotations

import asyncio
import os
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


def _bootstrap_import_path() -> None:
    here = os.path.abspath(os.path.dirname(__file__))
    for candidate in (os.path.join(here, "..", "backend"), os.path.join(here, "..")):
        if os.path.isdir(os.path.join(candidate, "app")):
            sys.path.insert(0, candidate)
            return
    raise RuntimeError("Could not locate backend app package")


_bootstrap_import_path()

from app.application.visual_search.visual_search_engine import index_product_from_image_urls
from app.core.config import get_settings
from app.infrastructure.ai_clients.embedding import EmbeddingClient
from app.infrastructure.db.models import ProductModel

settings = get_settings()
engine = create_async_engine(settings.async_database_url, echo=False)
SessionFactory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


def _embed_text(name: str, desc: str, attrs: dict | None) -> str:
    attrs = attrs or {}
    parts = [
        name,
        desc,
        str(attrs.get("root_category") or ""),
        str(attrs.get("sub_category") or ""),
        str(attrs.get("category") or ""),
        str(attrs.get("material") or ""),
        str(attrs.get("color") or ""),
    ]
    return " ".join(p for p in parts if p).strip()


async def main() -> None:
    embedder = EmbeddingClient()
    updated = 0
    visual_ok = 0
    gemini_ok = 0
    async with SessionFactory() as db:
        rows = (await db.execute(select(ProductModel))).scalars().all()
        for product in rows:
            text = _embed_text(product.name, product.description or "", product.attributes or {})
            product.embedding = await embedder.embed(text or product.name)
            hint = text or product.name
            try:
                vec, source, phash = await index_product_from_image_urls(
                    list(product.images or []),
                    text_hint=hint,
                )
                product.visual_embedding = vec
                attrs = dict(product.attributes or {})
                if phash:
                    attrs["phash"] = phash
                attrs["visual_embed_source"] = source
                product.attributes = attrs
                visual_ok += 1
                if source == "gemini":
                    gemini_ok += 1
            except Exception:
                pass
            updated += 1
        await db.commit()
    print(
        f"Re-embedded {updated} products | visual: {visual_ok} (gemini: {gemini_ok}) | "
        f"text_embed={'openai' if settings.openai_api_key else 'deterministic'}"
    )


if __name__ == "__main__":
    asyncio.run(main())
