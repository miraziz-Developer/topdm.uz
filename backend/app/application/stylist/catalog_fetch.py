"""Load Postgres catalog for Groq stylist — vector + keyword hybrid."""

from __future__ import annotations

import re
from uuid import UUID

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.agents.bozor_chat_catalog import (
    build_catalog_search_query,
    parse_bazaar_intent,
    parse_category_hint,
)
from app.application.stylist.budget_uzs import normalize_budget_uzs
from app.ai.intent_analyzer import parse_budget_with_fx
from app.infrastructure.ai_clients.embedding import EmbeddingClient
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.infrastructure.repositories.product_repo import ProductRepo
from app.interfaces.api.serializers import product_to_dict
from app.services.semantic_guardrails import filter_db_by_guardrails, normalize_gender

_STYLE_SEARCH_TERMS = (
    "klassik",
    "classic",
    "polo",
    "koylak",
    "ko'ylak",
    "kostyum",
    "shim",
    "jinsi",
    "krossovka",
    "tufli",
    "futbolka",
    "kurtka",
    "sport",
    "trening",
    "erkak",
    "ayol",
    "bolalar",
)
_NOISE = re.compile(
    r"\b(menda|men|bor|pul|look|kere|kerak|qber|ber|qanaqa|qanday|uchun|gacha|so'm|sum|usd|\$|€|eur)\b",
    re.IGNORECASE,
)


def _catalog_search_query(user_message: str) -> str | None:
    lowered = (user_message or "").lower()
    tokens: list[str] = []
    for term in _STYLE_SEARCH_TERMS:
        if term in lowered or term.replace("'", "") in lowered:
            tokens.append(term.replace("'", ""))
    if "poll" in lowered or "polo" in lowered:
        tokens.append("polo")
    if "klassika" in lowered or "klassik" in lowered:
        tokens.extend(["klassik", "ko'ylak", "kostyum"])
    if tokens:
        return " ".join(dict.fromkeys(tokens))
    cleaned = _NOISE.sub(" ", lowered)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if len(cleaned) >= 3:
        return cleaned[:64]
    return None


def _merge_product_dicts(primary: list[dict], extra: list[dict], *, limit: int) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for row in primary + extra:
        pid = str(row.get("id") or "")
        if not pid or pid in seen:
            continue
        seen.add(pid)
        out.append(row)
        if len(out) >= limit:
            break
    return out


async def _fetch_vector_rows(
    db: AsyncSession,
    search_q: str,
    *,
    limit: int,
    min_price: int | None,
    max_price: int | None,
    analysis: dict | None,
    user_message: str,
) -> list[dict]:
    """Semantic pgvector search — best pool for Groq outfit picking."""
    embedder = EmbeddingClient()
    product_repo = ProductRepo(db)
    marketplace_repo = MarketplaceRepository(db)

    category = parse_category_hint(user_message)
    if analysis and analysis.get("gender") in ("erkak", "ayol"):
        category = category or str(analysis["gender"])

    filters: dict = {"text": search_q}
    if category:
        filters["category_hint"] = category

    style = str((analysis or {}).get("style") or "").lower()
    if style in ("gym", "sport"):
        filters["style_tags"] = ["sport", "trening", "futbolka", "krossovka", "gym"]
    elif style == "formal":
        filters["style_tags"] = ["klassik", "kostyum", "ko'ylak"]

    gender = normalize_gender(str((analysis or {}).get("gender") or ""), user_message)
    if gender in ("erkak", "ayol"):
        filters["gender"] = gender

    try:
        vector = await embedder.embed(search_q)
    except Exception as exc:
        logger.warning("stylist_catalog_embed_failed: {}", exc)
        return []

    min_f = float(min_price) if min_price is not None else None
    max_f = float(max_price) if max_price is not None else None

    try:
        matches = await product_repo.hybrid_search(
            vector,
            filters,
            limit=limit,
            min_price=min_f,
            max_price=max_f,
        )
    except Exception as exc:
        logger.warning("stylist_catalog_hybrid_failed: {}", exc)
        matches = []

    items: list[dict] = []
    for m in matches:
        try:
            full = await marketplace_repo.get_product_by_id(UUID(str(m.id)))
        except (TypeError, ValueError):
            continue
        if full:
            items.append(product_to_dict(full))

    if len(items) < max(8, limit // 3):
        for max_dist in (0.82, 0.9, 0.96):
            try:
                neighbors = await product_repo.vector_similarity_fallback(
                    vector,
                    limit=limit,
                    max_cosine_distance=max_dist,
                    category_hint=category or "",
                    style_tags=list(filters.get("style_tags") or []),
                )
            except Exception:
                neighbors = []
            for m in neighbors:
                pid = str(m.id)
                if any(str(x.get("id")) == pid for x in items):
                    continue
                try:
                    full = await marketplace_repo.get_product_by_id(UUID(pid))
                except (TypeError, ValueError):
                    continue
                if full:
                    row = product_to_dict(full)
                    row["catalog_source"] = "vector_fallback"
                    items.append(row)
                if len(items) >= limit:
                    break
            if len(items) >= max(8, limit // 3):
                break

    for row in items:
        row.setdefault("catalog_source", "vector")
    return items[:limit]


async def fetch_stylist_catalog(
    db: AsyncSession,
    user_message: str,
    *,
    limit: int = 64,
    analysis: dict | None = None,
) -> list[dict]:
    """
    Hybrid catalog for Groq: vector similarity first, ILIKE top-up, guardrails, featured fill.
    """
    repo = MarketplaceRepository(db)
    text = (user_message or "").strip()
    min_p, max_p, _fx = parse_budget_with_fx(text)
    max_uzs = normalize_budget_uzs(max_p, text, default=0) if max_p else None
    if max_uzs == 0:
        max_uzs = None
    bazaar = parse_bazaar_intent(text)

    semantic_q = ""
    if analysis:
        semantic_q = str(analysis.get("search_keywords") or "").strip()
    search_q = semantic_q or _catalog_search_query(text) or build_catalog_search_query(
        text,
        parse_category_hint(text),
    )
    if not search_q:
        search_q = text[:64] if text else "kiyim"

    vector_limit = min(limit, 48)
    keyword_limit = min(limit, 40)

    vector_rows = await _fetch_vector_rows(
        db,
        search_q,
        limit=vector_limit,
        min_price=int(min_p) if min_p is not None else None,
        max_price=int(max_uzs) if max_uzs else None,
        analysis=analysis,
        user_message=text,
    )

    ilike_rows = [
        product_to_dict(p)
        for p in await repo.search_products(
            search_q,
            keyword_limit,
            0,
            min_price=int(min_p) if min_p is not None else None,
            max_price=int(max_uzs) if max_uzs else None,
            market_zone=bazaar.get("market_zone"),
            block_sector=bazaar.get("block_sector"),
        )
    ]
    for row in ilike_rows:
        row.setdefault("catalog_source", "keyword")

    merged = _merge_product_dicts(vector_rows, ilike_rows, limit=limit)

    if len(merged) < min(20, limit):
        seen = {str(r.get("id")) for r in merged}
        for featured in await repo.list_featured_products(limit=limit):
            pid = str(featured.id)
            if pid not in seen:
                row = product_to_dict(featured)
                row["catalog_source"] = "featured"
                merged.append(row)
                seen.add(pid)
            if len(merged) >= limit:
                break

    meta = (analysis or {}).get("_guardrail_meta") if analysis else None
    if not meta and analysis:
        meta = {
            "style": analysis.get("style"),
            "age_group": analysis.get("age_group"),
            "gender": analysis.get("gender"),
            "_user_blob": text,
            "budget": analysis.get("budget_uzs"),
            "_budget_uzs": analysis.get("budget_uzs"),
        }
    if meta:
        meta = dict(meta)
        meta.setdefault("_user_blob", text)
        filtered = filter_db_by_guardrails(merged, meta)
        if len(filtered) >= 6:
            merged = filtered
        elif merged:
            merged = merged[:limit]

    if max_uzs and max_uzs > 0:
        affordable = [
            p
            for p in merged
            if float(p.get("price") or p.get("price_uzs") or 0) <= max_uzs * 1.15
        ]
        if len(affordable) >= 6:
            merged = affordable
        elif not affordable and merged:
            overflow = sorted(
                merged,
                key=lambda row: float(row.get("price") or row.get("price_uzs") or 0),
            )
            merged = []
            for row in overflow:
                price = float(row.get("price") or row.get("price_uzs") or 0)
                if price > max_uzs * 3.5:
                    continue
                if price > max_uzs * 1.15:
                    row = dict(row)
                    row["budget_overflow"] = True
                merged.append(row)
                if len(merged) >= limit:
                    break

    in_stock = [
        p
        for p in merged
        if p.get("is_available") is not False and int(p.get("stock_count") or 1) > 0
    ]
    if len(in_stock) >= 6:
        merged = in_stock

    return merged[:limit]
