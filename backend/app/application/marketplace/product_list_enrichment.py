"""Attach review_summary to public product list payloads."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.marketplace.product_review_service import ProductReviewService
from app.infrastructure.db.models import OrderModel
from app.interfaces.api.serializers import product_to_dict


async def _attach_sold_counts(session: AsyncSession, products: list) -> None:
    if not products:
        return
    ids = [p.id for p in products]
    rows = await session.execute(
        select(OrderModel.product_id, func.coalesce(func.sum(OrderModel.quantity), 0))
        .where(OrderModel.product_id.in_(ids), OrderModel.status == "completed")
        .group_by(OrderModel.product_id)
    )
    sold_map = {pid: int(qty) for pid, qty in rows.all()}
    for p in products:
        setattr(p, "sold_count", sold_map.get(p.id, 0))


async def products_to_public_dicts(session: AsyncSession, products: list) -> list[dict]:
    if not products:
        return []
    await _attach_sold_counts(session, products)
    ids: list[UUID] = [p.id for p in products]
    summaries = await ProductReviewService(session).batch_summaries(ids)
    items: list[dict] = []
    for product in products:
        row = product_to_dict(product)
        summary = summaries.get(str(product.id))
        if summary:
            row["review_summary"] = summary
        items.append(row)
    return items
