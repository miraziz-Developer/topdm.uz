"""Visual search: preprocess → CLIP embed → pgvector cosine ANN (+ pHash duplicate)."""

from __future__ import annotations

import io
from typing import Any
from uuid import UUID

from loguru import logger

from app.application.visual_search.crop_preprocess import prepare_taobao_crop, prepare_taobao_crop_bytes
from app.application.visual_search.visual_signature import (
    ensemble_query_signatures,
    image_phash_hex,
    image_visual_signature,
    phash_hamming,
)
from app.core.config import get_settings
from app.infrastructure.ai_clients.clip_visual_embed import ClipVisualEmbedder
from app.infrastructure.ai_clients.gemini_visual_embed import GeminiVisualEmbedder, average_normalized_vectors
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.infrastructure.repositories.product_repo import ProductRepo

CLIP_CATALOG_EMBED_SOURCES = (
    "clip",
    "clip_multi",
    "gemini",
    "gemini_multi",
    "signature",
    "signature_multi",
)
MIN_PRODUCT_MATCH_PCT = 38
MIN_OUTFIT_MATCH_PCT = 48
PHASH_DUP_HAMMING = 12
PHASH_NEAR_HAMMING = 24


def _product_phash(meta: dict[str, Any] | None) -> str:
    if not meta:
        return ""
    return str(meta.get("phash") or meta.get("phash_prepared") or "")


def _query_phash_variants(image_bytes: bytes, prepared: bytes) -> list[str]:
    hashes: list[str] = []
    for raw in (prepared, image_bytes):
        hx = image_phash_hex(raw)
        if hx and hx not in hashes:
            hashes.append(hx)
    return hashes


def _best_phash_hamming(query_hashes: list[str], catalog_phash: str) -> int:
    if not catalog_phash or not query_hashes:
        return 64
    return min(phash_hamming(q, catalog_phash) for q in query_hashes)


def visual_match_percent(
    distance: float,
    *,
    duplicate: bool = False,
    source: str = "clip",
    phash_hamming_dist: int | None = None,
) -> int:
    if duplicate or source == "phash":
        return 99
    if phash_hamming_dist is not None and phash_hamming_dist <= PHASH_DUP_HAMMING:
        return 99
    if source in ("clip", "clip_multi", "unicom", "gemini", "gemini_multi"):
        # L2-normalized vektorlarda cosine_distance ≈ 1 − cosine_similarity
        pct = int(round(max(0, min(99, (1.0 - distance) * 100))))
        if distance <= 0.06:
            return 99
        if distance <= 0.12:
            return max(pct, 95)
        if phash_hamming_dist is not None and phash_hamming_dist <= PHASH_NEAR_HAMMING:
            return max(pct, 90)
        return pct
    pct = int(max(0, min(99, (1.0 - distance / 0.38) * 100)))
    return pct


def _clip_distance_caps(*, fast: bool) -> tuple[float, ...]:
    return (0.32, 0.40, 0.48, 0.56) if fast else (0.28, 0.36, 0.44, 0.52)


def _legacy_distance_caps(*, fast: bool) -> tuple[float, ...]:
    return (0.45, 0.62, 0.82, 0.95) if fast else (0.32, 0.42, 0.55, 0.68)


def _is_trusted_match(row: dict[str, Any]) -> bool:
    pct = int(row.get("visual_match_pct") or 0)
    mode = str(row.get("match_mode") or "")
    return pct >= 90 or mode == "phash"


def _filter_visual_rows(
    rows: list[dict[str, Any]],
    *,
    backend: str,
    strict: bool,
) -> list[dict[str, Any]]:
    if not rows:
        return rows
    trusted = [r for r in rows if _is_trusted_match(r)]
    rest = [r for r in rows if r not in trusted]
    if backend != "clip":
        return trusted + rest

    min_pct = MIN_OUTFIT_MATCH_PCT if strict else MIN_PRODUCT_MATCH_PCT
    strong = [r for r in rest if int(r.get("visual_match_pct") or 0) >= min_pct]
    if strong:
        return trusted + strong
    if strict:
        return trusted
    ranked = sorted(rest, key=lambda r: int(r.get("visual_match_pct") or 0), reverse=True)
    return trusted + ranked[:8]


async def _clip_query_variants(prepared_bytes: bytes, *, fast: bool) -> list[tuple[list[float], float]]:
    embedder = ClipVisualEmbedder()
    clip_vec = await embedder.embed_image(prepared_bytes)
    if fast:
        # Tez rejimda ham 2 ta masshtab — yaxshiroq crop moslik (Taobao uslubi)
        from PIL import Image, ImageOps

        from app.application.visual_search.visual_signature import _center_crop, _pad_square

        pil = Image.open(io.BytesIO(prepared_bytes)).convert("RGB")
        buf = io.BytesIO()
        ImageOps.autocontrast(_pad_square(_center_crop(pil, 0.88))).save(buf, format="JPEG", quality=90)
        try:
            clip2 = await embedder.embed_image(buf.getvalue())
            return [(clip_vec, 1.0), (clip2, 0.92)]
        except Exception:
            return [(clip_vec, 1.0)]
    from PIL import Image, ImageOps

    from app.application.visual_search.visual_signature import _center_crop, _pad_square

    pil = Image.open(io.BytesIO(prepared_bytes)).convert("RGB")
    buf = io.BytesIO()
    ImageOps.autocontrast(_pad_square(_center_crop(pil, 0.92))).save(buf, format="JPEG", quality=90)
    clip2 = await embedder.embed_image(buf.getvalue())
    buf3 = io.BytesIO()
    ImageOps.autocontrast(_pad_square(_center_crop(pil, 0.78))).save(buf3, format="JPEG", quality=90)
    clip3 = await embedder.embed_image(buf3.getvalue())
    return [(clip_vec, 1.0), (clip2, 0.9), (clip3, 0.85)]


async def _query_embedding_vectors(crop_bytes: bytes, *, hint: str, fast: bool = False) -> list[tuple[list[float], float]]:
    settings = get_settings()
    out: list[tuple[list[float], float]] = []
    prepared_bytes = prepare_taobao_crop_bytes(crop_bytes)
    backend = (settings.visual_search_backend or "clip").lower()

    if backend == "clip":
        try:
            return await _clip_query_variants(prepared_bytes, fast=fast)
        except Exception as exc:
            logger.warning("clip_query_embed_failed", error=str(exc)[:180])

    if backend == "gemini" and settings.visual_search_use_gemini and settings.google_api_key:
        embedder = GeminiVisualEmbedder()
        try:
            gemini_vec = await embedder.embed_image(prepared_bytes, hint=hint)
            out.append((gemini_vec, 1.0))
        except Exception as exc:
            logger.warning("gemini_query_embed_failed", error=str(exc)[:180])

    signatures = ensemble_query_signatures(prepared_bytes)
    if signatures:
        out.append((signatures[0], 0.95))
    if not out:
        out.append((image_visual_signature(prepared_bytes), 1.0))
    return out


async def _phash_catalog_scan(
    product_repo: ProductRepo,
    *,
    query_hashes: list[str],
    limit: int,
    min_price: float | None,
    max_price: float | None,
) -> list[tuple[str, tuple[float, bool, str, int]]]:
    from sqlalchemy import select

    from app.infrastructure.db.models import ProductModel

    session = product_repo._db
    result = await session.execute(
        select(ProductModel).where(
            ProductModel.is_available == True,
            ProductModel.visual_embedding.is_not(None),
        )
    )
    scored: list[tuple[str, int]] = []
    for model in result.scalars().all():
        ph = _product_phash(model.attributes or {})
        if not ph:
            continue
        if min_price is not None and model.price < int(min_price):
            continue
        if max_price is not None and model.price > int(max_price):
            continue
        ham = _best_phash_hamming(query_hashes, ph)
        if ham <= PHASH_NEAR_HAMMING:
            scored.append((str(model.id), ham))
    scored.sort(key=lambda x: x[1])
    out: list[tuple[str, tuple[float, bool, str, int]]] = []
    for pid, ham in scored[:limit]:
        is_dup = ham <= PHASH_DUP_HAMMING
        out.append((pid, (0.01 if is_dup else 0.08 + ham * 0.008, is_dup, "phash", ham)))
    return out


def _rows_from_ordered(
    ordered: list[tuple[str, tuple[float, bool, str, int | None]]],
    product_map: dict[UUID, Any],
) -> list[dict[str, Any]]:
    from app.interfaces.api.serializers import product_to_dict

    rows: list[dict[str, Any]] = []
    for pid, (dist, is_dup, src, ham) in ordered:
        product = product_map.get(UUID(pid))
        if not product:
            continue
        row = product_to_dict(product)
        row["visual_distance"] = round(dist, 4)
        row["visual_match_pct"] = visual_match_percent(
            dist,
            duplicate=is_dup,
            source=src,
            phash_hamming_dist=ham,
        )
        row["visual_match"] = True
        if src == "phash":
            row["match_mode"] = "phash"
        elif src in ("clip", "clip_multi"):
            row["match_mode"] = "clip"
        elif src == "gemini":
            row["match_mode"] = "gemini"
        else:
            row["match_mode"] = "visual"
        rows.append(row)
    return rows


async def clip_pgvector_search(
    product_repo: ProductRepo,
    marketplace_repo: MarketplaceRepository,
    image_bytes: bytes,
    *,
    limit: int = 20,
    min_price: float | None = None,
    max_price: float | None = None,
    strict: bool = False,
) -> list[dict[str, Any]]:
    """
    Diagram pipeline: preprocess → CLIP 768-d → pgvector cosine → top N.
    """
    settings = get_settings()
    backend = (settings.visual_search_backend or "clip").lower()
    prepared = prepare_taobao_crop_bytes(image_bytes)
    query_hashes = _query_phash_variants(image_bytes, prepared)
    embed_sources = list(CLIP_CATALOG_EMBED_SOURCES) if backend == "clip" else None
    max_dist = 0.52 if strict else 0.58

    best: dict[str, tuple[float, bool, str, int | None]] = {}

    for pid, (score, is_dup, src, ham) in await _phash_catalog_scan(
        product_repo,
        query_hashes=query_hashes,
        limit=limit,
        min_price=min_price,
        max_price=max_price,
    ):
        best[pid] = (score, is_dup, src, ham)

    try:
        query_vectors = await _query_embedding_vectors(prepared, hint="visual", fast=True)
    except Exception as exc:
        logger.warning("clip_pgvector_embed_failed", error=str(exc)[:180])
        query_vectors = []

    for qvec, qweight in query_vectors:
        scored = await product_repo.visual_similarity_search_scored(
            qvec,
            limit=limit * 3,
            max_cosine_distance=max_dist,
            min_price=min_price,
            max_price=max_price,
            image_only=True,
            embed_sources=embed_sources,
        )
        for product, dist in scored:
            pid = str(product.id)
            meta = product.ai_metadata or {}
            prod_hash = _product_phash(meta)
            ham = _best_phash_hamming(query_hashes, prod_hash) if prod_hash else 64
            is_dup = ham <= PHASH_DUP_HAMMING
            score = (0.01 if is_dup else dist) * qweight
            prev = best.get(pid)
            if prev is None or score < prev[0]:
                src = str(meta.get("visual_embed_source") or "clip")
                best[pid] = (score, is_dup, src, ham if prod_hash else None)

    ordered = sorted(best.items(), key=lambda x: x[1][0])[:limit]
    product_map = await marketplace_repo.get_products_by_ids([UUID(pid) for pid, _ in ordered])
    rows = _rows_from_ordered(ordered, product_map)
    return _filter_visual_rows(rows, backend=backend, strict=strict)


async def taobao_search_by_crop(
    product_repo: ProductRepo,
    marketplace_repo: MarketplaceRepository,
    crop_bytes: bytes,
    *,
    limit: int = 12,
    min_price: float | None = None,
    max_price: float | None = None,
    search_hint: str = "fashion clothing product photo",
    fast: bool = True,
    strict: bool = False,
) -> list[dict[str, Any]]:
    prepared = prepare_taobao_crop_bytes(crop_bytes)
    settings = get_settings()
    backend = (settings.visual_search_backend or "clip").lower()
    embed_sources = list(CLIP_CATALOG_EMBED_SOURCES) if backend == "clip" else None
    max_dist = 0.52 if strict else 0.58
    query_hashes = _query_phash_variants(crop_bytes, prepared)
    best: dict[str, tuple[float, bool, str, int | None]] = {}

    for pid, (score, is_dup, src, ham) in await _phash_catalog_scan(
        product_repo,
        query_hashes=query_hashes,
        limit=limit,
        min_price=min_price,
        max_price=max_price,
    ):
        best[pid] = (score, is_dup, src, ham)

    try:
        query_vectors = await _query_embedding_vectors(prepared, hint=search_hint, fast=fast)
    except Exception as exc:
        logger.warning("taobao_crop_embed_failed", error=str(exc)[:180])
        query_vectors = []

    for qvec, qweight in query_vectors:
        scored = await product_repo.visual_similarity_search_scored(
            qvec,
            limit=limit * 3,
            max_cosine_distance=max_dist,
            min_price=min_price,
            max_price=max_price,
            image_only=True,
            embed_sources=embed_sources,
        )
        for product, dist in scored:
            pid = str(product.id)
            meta = product.ai_metadata or {}
            prod_hash = _product_phash(meta)
            ham = _best_phash_hamming(query_hashes, prod_hash) if prod_hash else 64
            is_dup = ham <= PHASH_DUP_HAMMING
            score = (0.01 if is_dup else dist) * qweight
            prev = best.get(pid)
            if prev is None or score < prev[0]:
                src = str(meta.get("visual_embed_source") or "clip")
                best[pid] = (score, is_dup, src, ham if prod_hash else None)

    ordered = sorted(best.items(), key=lambda x: x[1][0])[:limit]
    product_map = await marketplace_repo.get_products_by_ids([UUID(pid) for pid, _ in ordered])
    rows = _rows_from_ordered(ordered, product_map)
    return _filter_visual_rows(rows, backend=backend, strict=strict)


async def index_product_visual_embedding(
    *,
    image_bytes: bytes | None,
    text_hint: str,
) -> tuple[list[float], str, str]:
    from app.application.visual_search.visual_signature import image_phash_hex

    settings = get_settings()
    backend = (settings.visual_search_backend or "clip").lower()

    if backend == "clip" and image_bytes:
        embedder = ClipVisualEmbedder()
        try:
            prepared = prepare_taobao_crop_bytes(image_bytes)
            phash = image_phash_hex(prepared)
            vec = await embedder.embed_image(prepared)
            return vec, "clip", phash
        except Exception as exc:
            logger.warning("clip_product_embed_failed", error=str(exc)[:180])

    if backend == "gemini" and settings.visual_search_use_gemini and settings.google_api_key and image_bytes:
        embedder = GeminiVisualEmbedder()
        try:
            prepared = prepare_taobao_crop_bytes(image_bytes)
            phash = image_phash_hex(prepared)
            vec = await embedder.embed_image(prepared, hint=text_hint)
            return vec, "gemini", phash
        except Exception as exc:
            logger.warning("gemini_product_embed_failed", error=str(exc)[:180])

    if image_bytes:
        prepared = prepare_taobao_crop_bytes(image_bytes)
        return image_visual_signature(prepared), "signature", image_phash_hex(prepared)
    import hashlib

    from PIL import Image

    digest = hashlib.sha256((text_hint or "product").encode("utf-8")).digest()
    placeholder = Image.new("RGB", (128, 128), (digest[0], digest[1], digest[2]))
    buf = io.BytesIO()
    placeholder.save(buf, format="JPEG", quality=85)
    placeholder_bytes = buf.getvalue()
    return image_visual_signature(placeholder_bytes), "signature", image_phash_hex(placeholder_bytes)


async def index_product_from_image_urls(
    image_urls: list[str],
    *,
    text_hint: str,
) -> tuple[list[float], str, str]:
    from app.application.visual_search.image_fetch import fetch_image_bytes

    vectors: list[list[float]] = []
    sources: list[str] = []
    phash = ""
    for url in image_urls[:3]:
        raw = await fetch_image_bytes(url)
        if not raw:
            continue
        vec, src, ph = await index_product_visual_embedding(image_bytes=raw, text_hint=text_hint)
        vectors.append(vec)
        sources.append(src)
        if ph and not phash:
            phash = ph
    if vectors:
        if all(s == "clip" for s in sources):
            label = "clip_multi" if len(vectors) > 1 else "clip"
            return average_normalized_vectors(vectors), label, phash
        if all(s == "gemini" for s in sources):
            label = "gemini_multi" if len(vectors) > 1 else "gemini"
            return average_normalized_vectors(vectors), label, phash
        src = "signature_multi" if len(vectors) > 1 else "signature"
        return average_normalized_vectors(vectors), src, phash
    return await index_product_visual_embedding(image_bytes=None, text_hint=text_hint)
