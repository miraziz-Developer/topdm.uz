"""
Rebuild product embeddings from title + description + category metadata.
Run: docker compose exec backend python /app/scripts/reembed_products.py
     docker compose exec backend python /app/scripts/reembed_products.py --visual-only
"""
from __future__ import annotations

import argparse
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


async def main(*, visual_only: bool = False, limit: int | None = None, offset: int = 0) -> None:
    embedder = None if visual_only else EmbeddingClient()
    updated = 0
    visual_ok = 0
    visual_fail = 0
    clip_ok = 0
    gemini_ok = 0
    async with SessionFactory() as db:
        rows = (await db.execute(select(ProductModel).order_by(ProductModel.id))).scalars().all()
        if offset > 0:
            rows = rows[offset:]
        if limit is not None and limit > 0:
            rows = rows[:limit]
        for product in rows:
            text = _embed_text(product.name, product.description or "", product.attributes or {})
            if not visual_only and embedder is not None:
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
                if source in ("clip", "clip_multi"):
                    clip_ok += 1
                elif source in ("gemini", "gemini_multi"):
                    gemini_ok += 1
            except Exception as exc:
                visual_fail += 1
                print(f"  FAIL {product.id}: {exc}", file=sys.stderr)
            updated += 1
            if visual_only and updated % 25 == 0:
                await db.commit()
                print(f"  … {updated}/{len(rows)} vizual indeks")
        await db.commit()
    text_mode = "skipped" if visual_only else ("openai" if settings.openai_api_key else "deterministic")
    print(
        f"Re-embedded {updated} products | visual: {visual_ok} ok, {visual_fail} fail "
        f"(clip: {clip_ok}, gemini: {gemini_ok}) | text_embed={text_mode}"
    )
    if visual_fail and updated and visual_fail / updated > 0.25:
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Mahsulot embedding qayta yaratish")
    parser.add_argument(
        "--visual-only",
        action="store_true",
        help="Faqat CLIP visual_embedding (Gemini matn embedsiz)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Faqat N ta mahsulot (deploy/test uchun)",
    )
    parser.add_argument(
        "--offset",
        type=int,
        default=0,
        help="ProductModel.id tartibida skip (batch re-embed)",
    )
    args = parser.parse_args()
    asyncio.run(main(visual_only=args.visual_only, limit=args.limit, offset=args.offset))
