"""Taobao-max visual search: Gemini multimodal + signature ensemble + pHash."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from loguru import logger

from app.application.visual_search.visual_signature import (
    ensemble_query_signatures,
    image_phash_hex,
    image_visual_signature,
    phash_hamming,
)
from app.core.config import get_settings
from app.infrastructure.ai_clients.gemini_visual_embed import GeminiVisualEmbedder, average_normalized_vectors
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.infrastructure.repositories.product_repo import ProductRepo


def visual_match_percent(distance: float, *, duplicate: bool = False) -> int:
    if duplicate:
        return 99
    # Gemini cosine: tighter spread than legacy signature
    pct = int(max(0, min(99, (1.0 - distance / 0.38) * 100)))
    return pct


async def _query_embedding_vectors(crop_bytes: bytes, *, hint: str, fast: bool = False) -> list[tuple[list[float], float]]:
    """Build one or more query vectors (vector, weight)."""
    settings = get_settings()
    out: list[tuple[list[float], float]] = []

    if not fast and settings.visual_search_use_gemini and settings.google_api_key:
        embedder = GeminiVisualEmbedder()
        try:
            gemini_vec = await embedder.embed_image(crop_bytes, hint=hint)
            out.append((gemini_vec, 1.0))
            # Slight crop variants in Gemini space
            from PIL import Image
            import io
            from app.application.visual_search.visual_signature import _center_crop, _pad_square
            from PIL import ImageOps

            pil = Image.open(io.BytesIO(crop_bytes)).convert("RGB")
            buf = io.BytesIO()
            ImageOps.autocontrast(_pad_square(_center_crop(pil, 0.92))).save(buf, format="JPEG", quality=90)
            gemini2 = await embedder.embed_image(buf.getvalue(), hint=hint)
            out.append((gemini2, 0.92))
        except Exception as exc:
            logger.warning("gemini_query_embed_failed", error=str(exc)[:180])

    if fast and settings.visual_search_use_gemini and settings.google_api_key:
        embedder = GeminiVisualEmbedder()
        try:
            gemini_vec = await embedder.embed_image(crop_bytes, hint=hint)
            out.append((gemini_vec, 1.0))
        except Exception as exc:
            logger.warning("gemini_query_embed_failed", error=str(exc)[:180])

    signatures = ensemble_query_signatures(crop_bytes)
    if fast:
        if signatures:
            out.append((signatures[0], 1.0))
    else:
        for idx, sig in enumerate(signatures):
            out.append((sig, 0.55 - idx * 0.06))

    if not out:
        out.append((image_visual_signature(crop_bytes), 1.0))
    return out


async def taobao_search_by_crop(
    product_repo: ProductRepo,
    marketplace_repo: MarketplaceRepository,
    crop_bytes: bytes,
    *,
    limit: int = 12,
    min_price: float | None = None,
    max_price: float | None = None,
    search_hint: str = "fashion clothing product photo",
    fast: bool = False,
) -> list[dict[str, Any]]:
    from app.interfaces.api.serializers import product_to_dict

    query_hash = image_phash_hex(crop_bytes)
    query_vectors = await _query_embedding_vectors(crop_bytes, hint=search_hint, fast=fast)

    best: dict[str, tuple[float, bool, str]] = {}  # id -> (score, dup, source)

    distance_caps = (0.42, 0.58) if fast else (0.32, 0.42, 0.55, 0.68)
    scan_multiplier = 2 if fast else 4

    for qvec, qweight in query_vectors:
        for cap in distance_caps:
            scored = await product_repo.visual_similarity_search_scored(
                qvec,
                limit=limit * scan_multiplier,
                max_cosine_distance=cap,
                min_price=min_price,
                max_price=max_price,
                image_only=True,
            )
            if not scored:
                continue
            for product, dist in scored:
                pid = str(product.id)
                meta = product.ai_metadata or {}
                prod_hash = str(meta.get("phash") or "")
                is_dup = phash_hamming(query_hash, prod_hash) <= 8 if prod_hash else False
                score = (0.01 if is_dup else dist) * qweight
                prev = best.get(pid)
                if prev is None or score < prev[0]:
                    src = str(meta.get("visual_embed_source") or "visual")
                    best[pid] = (score, is_dup, src)
            if len(best) >= limit:
                break
        if len(best) >= limit * 2:
            break

    ordered = sorted(best.items(), key=lambda x: x[1][0])[:limit]
    product_map = await marketplace_repo.get_products_by_ids([UUID(pid) for pid, _ in ordered])
    rows: list[dict[str, Any]] = []
    for pid, (dist, is_dup, src) in ordered:
        product = product_map.get(UUID(pid))
        if not product:
            continue
        row = product_to_dict(product)
        row["visual_distance"] = round(dist, 4)
        row["visual_match_pct"] = visual_match_percent(dist, duplicate=is_dup)
        row["visual_match"] = True
        row["match_mode"] = "gemini" if src == "gemini" else "visual"
        rows.append(row)
    return rows


async def index_product_visual_embedding(
    *,
    image_bytes: bytes | None,
    text_hint: str,
) -> tuple[list[float], str, str]:
    """Returns (vector, source, phash_hex)."""
    from app.application.visual_search.visual_signature import image_phash_hex

    phash = image_phash_hex(image_bytes) if image_bytes else ""
    settings = get_settings()

    if settings.visual_search_use_gemini and settings.google_api_key and image_bytes:
        embedder = GeminiVisualEmbedder()
        try:
            vec = await embedder.embed_image(image_bytes, hint=text_hint)
            return vec, "gemini", phash
        except Exception as exc:
            logger.warning("gemini_product_embed_failed", error=str(exc)[:180])

    if image_bytes:
        return image_visual_signature(image_bytes), "signature", phash
    return image_visual_signature(text_hint.encode("utf-8")), "signature", phash


async def index_product_from_image_urls(
    image_urls: list[str],
    *,
    text_hint: str,
) -> tuple[list[float], str, str]:
    """Multi-image index (average Gemini vectors) — Taobao lists multiple angles."""
    from app.application.visual_search.image_fetch import fetch_image_bytes

    vectors: list[list[float]] = []
    phash = ""
    for url in image_urls[:3]:
        raw = await fetch_image_bytes(url)
        if not raw:
            continue
        vec, src, ph = await index_product_visual_embedding(image_bytes=raw, text_hint=text_hint)
        vectors.append(vec)
        if ph and not phash:
            phash = ph
    if vectors:
        return average_normalized_vectors(vectors), (
            "gemini" if get_settings().google_api_key else "signature"
        ), phash
    return await index_product_visual_embedding(image_bytes=None, text_hint=text_hint)
