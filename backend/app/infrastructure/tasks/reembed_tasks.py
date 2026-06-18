"""Celery orqali mahsulotlarni batch re-embed qilish."""
from __future__ import annotations

from loguru import logger

from app.infrastructure.tasks.async_runner import run_async_task
from app.infrastructure.tasks.celery_app import celery_app


@celery_app.task(name="catalog.reembed_visual_batch", bind=True, max_retries=1)
def reembed_visual_batch(self, *, limit: int = 200, offset: int = 0, chain: bool = False) -> dict:
    try:
        summary = run_async_task(_reembed_batch(limit=limit, offset=offset))
        summary["offset"] = offset
        if chain and summary.get("processed", 0) >= limit:
            reembed_visual_batch.delay(limit=limit, offset=offset + limit, chain=True)
        return summary
    except Exception as exc:
        logger.exception("reembed_visual_batch_failed")
        raise self.retry(exc=exc, countdown=300) from exc


@celery_app.task(name="catalog.reembed_visual_full", bind=True, max_retries=0)
def reembed_visual_full(self, *, batch_size: int = 200) -> dict:
    """Butun katalog bo'yicha ketma-ket batch re-embed (har batch keyingisini chaqiradi)."""
    reembed_visual_batch.delay(limit=batch_size, offset=0, chain=True)
    return {"queued": True, "batch_size": batch_size}


async def _reembed_batch(*, limit: int, offset: int) -> dict:
    from sqlalchemy import select

    from app.application.visual_search.visual_search_engine import index_product_from_image_urls
    from app.infrastructure.db.models import ProductModel
    from app.infrastructure.db.session import AsyncSessionFactory

    summary = {"processed": 0, "visual_ok": 0, "visual_fail": 0}
    async with AsyncSessionFactory() as session:
        rows = (
            await session.execute(
                select(ProductModel).order_by(ProductModel.id).offset(max(0, offset)).limit(max(1, min(limit, 500)))
            )
        ).scalars().all()
        for product in rows:
            summary["processed"] += 1
            hint = product.name or ""
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
                summary["visual_ok"] += 1
            except Exception as exc:
                summary["visual_fail"] += 1
                logger.warning("reembed_product_failed product_id={} err={}", product.id, exc)
        await session.commit()
    logger.info("reembed_visual_batch_done {}", summary)
    return summary
