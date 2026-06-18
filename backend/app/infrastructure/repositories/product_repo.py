from __future__ import annotations

from uuid import UUID

from sqlalchemy import String, and_, cast, not_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.visual_search.color_map import color_search_terms
from app.domain.entities.product import Product
from app.infrastructure.db.models import ProductModel, ShopModel


def _apply_color_filters(clauses: list, filters: dict, *, required: bool = False) -> bool:
    """ILIKE color tokens on name/description/attributes. Returns True if color clause added."""
    terms = list(filters.get("color_terms") or [])
    if not terms and filters.get("color"):
        terms = color_search_terms(str(filters.get("color")))
    if not terms:
        return False
    color_clauses: list = []
    for term in terms:
        t = str(term).strip().lower()
        if len(t) < 2:
            continue
        color_clauses.append(
            or_(
                ProductModel.name.ilike(f"%{t}%"),
                ProductModel.description.ilike(f"%{t}%"),
                cast(ProductModel.attributes["color"], String).ilike(f"%{t}%"),
            )
        )
    if color_clauses:
        clauses.append(or_(*color_clauses))
        return True
    return False


def _apply_strict_metadata_filters(clauses: list, filters: dict) -> None:
    """Hard slot boundaries — required when filters['strict_slot'] is True."""
    slot_keywords = filters.get("slot_category_keywords") or []
    if slot_keywords:
        kw_clauses: list = []
        for kw in slot_keywords:
            token = str(kw).strip().lower()
            if len(token) < 2:
                continue
            kw_clauses.append(
                or_(
                    ProductModel.name.ilike(f"%{token}%"),
                    ProductModel.description.ilike(f"%{token}%"),
                    cast(ProductModel.attributes["category"], String).ilike(f"%{token}%"),
                    cast(ProductModel.attributes["sub_category"], String).ilike(f"%{token}%"),
                    cast(ProductModel.attributes["root_category"], String).ilike(f"%{token}%"),
                )
            )
        if kw_clauses:
            clauses.append(or_(*kw_clauses))

    for pattern in filters.get("exclude_name_patterns") or []:
        p = str(pattern).strip().lower()
        if len(p) >= 3:
            # Faqat nom — tavsifda "ayollar uchun" bo'lsa ham vizual qidiruv ishlaydi
            clauses.append(not_(ProductModel.name.ilike(f"%{p}%")))

    gender = str(filters.get("gender") or "").strip().lower()
    if gender == "erkak":
        for p in ("ayol", "ayollar", "qiz", "kelin", "bolalar", "yubka", "dress"):
            clauses.append(not_(ProductModel.name.ilike(f"%{p}%")))
    elif gender == "ayol":
        for p in ("erkak", "erkaklar", "jinsi erkak"):
            clauses.append(not_(ProductModel.name.ilike(f"%{p}%")))


class ProductRepo:
    """Vector + lightweight metadata filters over marketplace `products` (seed + API data)."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def hybrid_search(
        self,
        query_embedding: list[float],
        filters: dict,
        limit: int = 20,
        min_price: float | None = None,
        max_price: float | None = None,
        block: str | None = None,
    ) -> list[Product]:
        stmt = (
            select(ProductModel)
            .options(selectinload(ProductModel.shop))
            .join(ShopModel, ShopModel.id == ProductModel.shop_id)
            .where(
                ProductModel.is_available == True,
                ProductModel.embedding.is_not(None),
                ShopModel.is_active.is_(True),
                ShopModel.is_verified.is_(True),
                ShopModel.is_blocked.is_(False),
            )
        )

        clauses: list = []
        exclude_ids = filters.get("exclude_ids") or []
        if exclude_ids:
            uuids = []
            for raw in exclude_ids:
                try:
                    uuids.append(UUID(str(raw)))
                except (TypeError, ValueError):
                    continue
            if uuids:
                clauses.append(ProductModel.id.not_in(uuids))

        if min_price is not None:
            clauses.append(ProductModel.price >= int(min_price))
        if max_price is not None:
            clauses.append(ProductModel.price <= int(max_price))
        if block:
            b = block.strip()
            if b:
                clauses.append(
                    or_(
                        ShopModel.floor.ilike(f"%{b}%"),
                        ShopModel.section.ilike(f"%{b}%"),
                    )
                )

        cat = filters.get("category") or filters.get("category_hint")
        if cat:
            c = str(cat).strip()
            if c:
                cat_clauses = [
                    ProductModel.name.ilike(f"%{c}%"),
                    ProductModel.description.ilike(f"%{c}%"),
                ]
                try:
                    cat_clauses.append(
                        cast(ProductModel.attributes["category"], String).ilike(f"%{c}%")
                    )
                except Exception:
                    pass
                clauses.append(or_(*cat_clauses))

        _apply_color_filters(clauses, filters)

        text_q = filters.get("text") or filters.get("query")
        if text_q:
            tokens = [tok for tok in str(text_q).strip().split() if len(tok) >= 3]
            token_clauses = [
                or_(
                    ProductModel.name.ilike(f"%{tok}%"),
                    ProductModel.description.ilike(f"%{tok}%"),
                )
                for tok in tokens
            ]
            if token_clauses:
                clauses.append(or_(*token_clauses))

        for tag in filters.get("style_tags") or []:
            t = str(tag).strip()
            if len(t) >= 3:
                clauses.append(
                    or_(
                        ProductModel.name.ilike(f"%{t}%"),
                        ProductModel.description.ilike(f"%{t}%"),
                    )
                )

        material = filters.get("material")
        if material:
            m = str(material).strip()
            if m:
                clauses.append(
                    or_(
                        ProductModel.name.ilike(f"%{m}%"),
                        ProductModel.attributes.contains({"material": m}),
                    )
                )

        sale_type = filters.get("sale_type")
        if sale_type:
            clauses.append(ProductModel.sale_type == str(sale_type).strip())

        root_cat = filters.get("root_category")
        if root_cat:
            rc = str(root_cat).strip()
            if rc:
                clauses.append(cast(ProductModel.attributes["root_category"], String).ilike(f"%{rc}%"))

        sub_cat = filters.get("sub_category")
        if sub_cat:
            sc = str(sub_cat).strip()
            if sc:
                clauses.append(
                    or_(
                        cast(ProductModel.attributes["sub_category"], String).ilike(f"%{sc}%"),
                        ProductModel.name.ilike(f"%{sc}%"),
                    )
                )

        if filters.get("strict_slot"):
            _apply_strict_metadata_filters(clauses, filters)

        if clauses:
            stmt = stmt.where(and_(*clauses))

        stmt = stmt.order_by(ProductModel.embedding.cosine_distance(query_embedding)).limit(limit)
        result = await self._db.execute(stmt)
        rows = result.scalars().unique().all()
        return self._rows_to_products(rows)

    async def vector_similarity_fallback(
        self,
        query_embedding: list[float],
        *,
        limit: int = 20,
        max_cosine_distance: float = 0.78,
        category_hint: str | None = None,
        color_hint: str | None = None,
        style_tags: list[str] | None = None,
        exclude_ids: list[str] | None = None,
        metadata_filters: dict | None = None,
    ) -> list[Product]:
        """Relaxed pgvector neighbors — keeps strict slot metadata when provided."""
        meta = metadata_filters or {}
        strict_slot = bool(meta.get("strict_slot"))
        distance = ProductModel.embedding.cosine_distance(query_embedding)

        async def _run(distance_cap: float) -> list[Product]:
            clauses: list = [
                ProductModel.is_available == True,
                ProductModel.embedding.is_not(None),
                distance <= distance_cap,
                ShopModel.is_active.is_(True),
                ShopModel.is_verified.is_(True),
                ShopModel.is_blocked.is_(False),
            ]
            if strict_slot:
                _apply_strict_metadata_filters(clauses, meta)
            else:
                soft: list = []
                if category_hint:
                    c = str(category_hint).strip()
                    if c and c.lower() not in {"kiyim", "unknown", "outfit"}:
                        soft.append(
                            or_(
                                ProductModel.name.ilike(f"%{c}%"),
                                ProductModel.description.ilike(f"%{c}%"),
                                cast(ProductModel.attributes["category"], String).ilike(f"%{c}%"),
                                cast(ProductModel.attributes["root_category"], String).ilike(f"%{c}%"),
                                cast(ProductModel.attributes["sub_category"], String).ilike(f"%{c}%"),
                            )
                        )
                if color_hint:
                    col = str(color_hint).strip()
                    if col:
                        soft.append(
                            or_(
                                ProductModel.name.ilike(f"%{col}%"),
                                ProductModel.attributes.contains({"color": col}),
                                cast(ProductModel.attributes["color"], String).ilike(f"%{col}%"),
                            )
                        )
                for tag in style_tags or []:
                    t = str(tag).strip()
                    if len(t) >= 3:
                        soft.append(ProductModel.name.ilike(f"%{t}%"))
                if soft:
                    clauses.append(or_(*soft))

            if exclude_ids:
                uuids = []
                for raw in exclude_ids:
                    try:
                        uuids.append(UUID(str(raw)))
                    except (TypeError, ValueError):
                        continue
                if uuids:
                    clauses.append(ProductModel.id.not_in(uuids))

            stmt = (
                select(ProductModel)
                .options(selectinload(ProductModel.shop))
                .join(ShopModel, ShopModel.id == ProductModel.shop_id)
                .where(and_(*clauses))
                .order_by(distance)
                .limit(max(limit * 2, limit))
            )
            result = await self._db.execute(stmt)
            return self._rows_to_products(result.scalars().unique().all()[:limit])

        rows = await _run(max_cosine_distance)
        if rows or strict_slot:
            return rows
        return await _run(min(0.92, max_cosine_distance + 0.12))

    async def keyword_slot_search(
        self,
        filters: dict,
        *,
        limit: int = 20,
        min_price: float | None = None,
        max_price: float | None = None,
        require_color: bool = False,
    ) -> list[Product]:
        """Slot + optional color text match (no loose 'sport'-only hits)."""

        async def _run(*, with_color: bool) -> list[Product]:
            stmt = (
                select(ProductModel)
                .options(selectinload(ProductModel.shop))
                .join(ShopModel, ShopModel.id == ProductModel.shop_id)
                .where(
                    ProductModel.is_available == True,
                    ShopModel.is_active.is_(True),
                    ShopModel.is_verified.is_(True),
                    ShopModel.is_blocked.is_(False),
                )
            )
            clauses: list = []
            if min_price is not None:
                clauses.append(ProductModel.price >= int(min_price))
            if max_price is not None:
                clauses.append(ProductModel.price <= int(max_price))

            slot_filters = {**filters, "strict_slot": True}
            _apply_strict_metadata_filters(clauses, slot_filters)

            if with_color:
                _apply_color_filters(clauses, filters, required=True)

            if clauses:
                stmt = stmt.where(and_(*clauses))
            stmt = stmt.order_by(ProductModel.is_featured.desc(), ProductModel.view_count.desc()).limit(limit)
            result = await self._db.execute(stmt)
            return self._rows_to_products(result.scalars().unique().all())

        if require_color or filters.get("color_terms") or filters.get("color"):
            colored = await _run(with_color=True)
            if colored:
                return colored
        return await _run(with_color=False)

    async def visual_similarity_search(
        self,
        query_visual: list[float],
        filters: dict | None = None,
        *,
        limit: int = 20,
        max_cosine_distance: float = 0.55,
        min_price: float | None = None,
        max_price: float | None = None,
        image_only: bool = True,
    ) -> list[Product]:
        """
        Taobao-style image-to-image search.
        image_only=True: match by photo only (no title/slot SQL) — same image in DB always hits.
        """
        _ = filters
        distance = ProductModel.visual_embedding.cosine_distance(query_visual)

        async def _run(cap: float, *, with_price: bool = True) -> list[Product]:
            clauses: list = [
                ProductModel.is_available == True,
                ProductModel.visual_embedding.is_not(None),
                distance <= cap,
            ]
            if with_price:
                if min_price is not None:
                    clauses.append(ProductModel.price >= int(min_price))
                if max_price is not None:
                    clauses.append(ProductModel.price <= int(max_price))
            stmt = (
                select(ProductModel)
                .options(selectinload(ProductModel.shop))
                .join(ShopModel, ShopModel.id == ProductModel.shop_id)
                .where(and_(*clauses))
                .order_by(distance)
                .limit(max(limit * 3, limit))
            )
            result = await self._db.execute(stmt)
            return self._rows_to_products(result.scalars().unique().all()[:limit])

        if image_only:
            for cap in (max_cosine_distance, 0.72, 0.88, 1.15):
                rows = await _run(cap)
                if rows:
                    return rows
            return await _run(1.35)

        # Legacy path: optional metadata filters (text-assisted visual)
        clauses = [
            ProductModel.is_available == True,
            ProductModel.visual_embedding.is_not(None),
            distance <= max_cosine_distance,
        ]
        if min_price is not None:
            clauses.append(ProductModel.price >= int(min_price))
        if max_price is not None:
            clauses.append(ProductModel.price <= int(max_price))
        slot_filters = {**(filters or {}), "strict_slot": bool((filters or {}).get("strict_slot", True))}
        if slot_filters.get("strict_slot"):
            _apply_strict_metadata_filters(clauses, slot_filters)
        _apply_color_filters(clauses, filters or {})
        stmt = (
            select(ProductModel)
            .options(selectinload(ProductModel.shop))
            .join(ShopModel, ShopModel.id == ProductModel.shop_id)
            .where(and_(*clauses))
            .order_by(distance)
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        return self._rows_to_products(result.scalars().unique().all())

    async def visual_similarity_search_scored(
        self,
        query_visual: list[float],
        *,
        limit: int = 20,
        max_cosine_distance: float = 0.62,
        min_price: float | None = None,
        max_price: float | None = None,
        image_only: bool = True,
        embed_sources: list[str] | None = None,
    ) -> list[tuple[Product, float]]:
        _ = image_only
        distance_expr = ProductModel.visual_embedding.cosine_distance(query_visual)
        embed_src_col = ProductModel.attributes.op("->>")("visual_embed_source")

        from sqlalchemy import or_

        async def _run(cap: float) -> list[tuple[Product, float]]:
            clauses: list = [
                ProductModel.is_available == True,
                ProductModel.visual_embedding.is_not(None),
                distance_expr <= cap,
            ]
            if embed_sources:
                # Eski mahsulotlar (visual_embed_source yo'q) ham qidiruvda qatnashadi
                clauses.append(
                    or_(
                        embed_src_col.in_(embed_sources),
                        embed_src_col.is_(None),
                        embed_src_col == "",
                    )
                )
            if min_price is not None:
                clauses.append(ProductModel.price >= int(min_price))
            if max_price is not None:
                clauses.append(ProductModel.price <= int(max_price))
            stmt = (
                select(ProductModel, distance_expr.label("vis_dist"))
                .options(selectinload(ProductModel.shop))
                .join(ShopModel, ShopModel.id == ProductModel.shop_id)
                .where(and_(*clauses))
                .order_by(distance_expr)
                .limit(limit)
            )
            result = await self._db.execute(stmt)
            out: list[tuple[Product, float]] = []
            for model, dist in result.all():
                for prod in self._rows_to_products([model]):
                    out.append((prod, float(dist)))
            return out

        for cap in (max_cosine_distance, 0.78, 0.92, 1.15):
            rows = await _run(cap)
            if rows:
                return rows
        return await _run(1.35)

    def _rows_to_products(self, rows) -> list[Product]:
        products: list[Product] = []
        for p in rows:
            shop = p.shop
            image_url = p.images[0] if p.images else None
            loc_parts: list[str] = []
            if shop:
                if shop.floor:
                    loc_parts.append(str(shop.floor))
                if shop.section:
                    loc_parts.append(str(shop.section))
            products.append(
                Product(
                    id=str(p.id),
                    name=p.name,
                    price=float(p.price),
                    currency="UZS",
                    image_url=image_url,
                    shop_location=" • ".join(loc_parts) if loc_parts else None,
                    ai_metadata=dict(p.attributes or {}),
                )
            )
        return products
