"""Attach review_summary to public product list payloads."""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.marketplace.product_review_service import ProductReviewService
from app.infrastructure.db.models import CategoryModel, OrderModel
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


async def _category_meta_map(session: AsyncSession, products: list) -> dict[UUID, dict[str, str]]:
    cat_ids = {p.category_id for p in products if getattr(p, "category_id", None)}
    if not cat_ids:
        return {}

    result = await session.execute(select(CategoryModel).where(CategoryModel.id.in_(cat_ids)))
    cats = {row.id: row for row in result.scalars().all()}

    pending_parent_ids = {c.parent_id for c in cats.values() if c.parent_id and c.parent_id not in cats}
    while pending_parent_ids:
        parent_result = await session.execute(
            select(CategoryModel).where(CategoryModel.id.in_(pending_parent_ids))
        )
        loaded = list(parent_result.scalars().all())
        if not loaded:
            break
        for row in loaded:
            cats[row.id] = row
        pending_parent_ids = {
            c.parent_id for c in loaded if c.parent_id and c.parent_id not in cats
        }

    meta: dict[UUID, dict[str, str]] = {}
    for product in products:
        cat_id = getattr(product, "category_id", None)
        if not cat_id:
            continue
        cat = cats.get(cat_id)
        if not cat:
            continue
        root = cat
        while root.parent_id and root.parent_id in cats:
            root = cats[root.parent_id]
        meta[product.id] = {
            "category_id": str(cat.id),
            "category_name": cat.name,
            "root_category_name": root.name,
            "sub_category": cat.name if cat.id != root.id else "",
            "root_category": root.name,
        }
    return meta


async def products_to_public_dicts(session: AsyncSession, products: list) -> list[dict]:
    if not products:
        return []
    await _attach_sold_counts(session, products)
    category_meta = await _category_meta_map(session, products)
    ids: list[UUID] = [p.id for p in products]
    summaries = await ProductReviewService(session).batch_summaries(ids)
    items: list[dict] = []
    for product in products:
        row = product_to_dict(product, category_meta=category_meta.get(product.id))
        summary = summaries.get(str(product.id))
        if summary:
            row["review_summary"] = summary
        items.append(row)
    return items
