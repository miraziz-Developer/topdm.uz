from __future__ import annotations

import asyncio
import base64
import binascii
import io
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from loguru import logger
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.agents.bozor_chat_catalog import (
    build_catalog_search_query,
    build_jonli_katalog_natijasi,
    parse_budget_from_text,
    parse_category_hint,
    parse_look_intent,
    parse_sale_type,
)
from app.application.visual_search.category_map import normalize_visual_category
from app.application.visual_search.color_map import color_search_terms, color_uz_from_image, normalize_color_uz
from app.application.visual_search.slot_metadata import build_strict_slot_filters
from app.application.visual_search.taobao_fingerprint import build_taobao_fingerprint
from app.application.visual_search.visual_search_engine import taobao_search_by_crop
from app.application.visual_search.synthesize import synthesize_visual_search_narrative
from app.interfaces.api.serializers import product_to_dict
from app.infrastructure.ai_clients.embedding import EmbeddingClient
from app.infrastructure.ai_clients.gemini import GeminiClient, _guess_mime, _local_fallback_from_bytes
from app.infrastructure.ai_clients.groq import GroqClient
from app.infrastructure.db.session import AsyncSessionFactory
from app.infrastructure.repositories.marketplace_repo import MarketplaceRepository
from app.infrastructure.repositories.product_repo import ProductRepo


@dataclass(slots=True)
class DetectedOutfitItem:
    id: str
    label_uz: str
    category: str
    color: str | None
    material: str | None
    search_query: str
    bbox: dict[str, float]
    thumbnail_base64: str
    product_ids: list[str]


async def detect_outfit_items(raw: bytes) -> list[dict[str, Any]]:
    """Taobao-style: detect wearables on a person with normalized bounding boxes."""
    vision_raw = _downscale_image_bytes(raw, max_edge=768)
    settings_prompt = (
        "Sen O'zbekiston onlayn bozori (Bozorliii/Bozorliii) uchun vizual qidiruv AI sanaysan. "
        "To'liq komplekt/kostyum rasmda HAR BIR alohida parchani ajrat (Taobao): kurtka, ichki ko'ylak/sviter, "
        "shim, kamar (ko'rinsa), oyoq kiyim, sumka. Yuz, fon, qo'l — item emas. "
        "Har bir bbox faqat o'sha parchaning chegarasida; rang — aynan shu parchadagi asosiy rang. "
        "label_uz — qisqa o'zbekcha (Kurtka, Sviter, Shim, Krossovka, Kamar). "
        "category — INGLIZCHA slug: shoes | jacket | pants | shirt | top | dress | belt | bag. "
        "Sviter/xudi/futbolka → top yoki shirt; krossovka/tufli → shoes. "
        "color — MAJBURIY o'zbekcha: sariq, qora, oq, ko'k, qizil, yashil, bej, jigarrang, kulrang. "
        "search_query — rang + jins + buyum (masalan: 'qora erkak kurtka', 'oq sport krossovka'). "
        "bbox: 0-1 normal (x,y yuqori chap, w,h). Maksimum 6 ta item — ko'rinadigan hammasi alohida. "
        'Faqat JSON: {"items":[{"id":"1","label_uz":"Svitch","category":"top","color":"sariq",'
        '"material":"poliester","search_query":"sariq ayol sport sviter","bbox":{"x":0.1,"y":0.1,"w":0.5,"h":0.35}}]}'
    )
    groq = GroqClient()
    from app.core.config import get_settings

    settings = get_settings()
    if settings.groq_api_key:
        try:
            payload = await groq.chat_json(
                system_prompt=(
                    "Fashion object detector for Uzbek marketplace. "
                    "Output valid JSON only. category must be English slug."
                ),
                user_prompt=settings_prompt,
                vision=True,
                image_bytes=vision_raw,
                image_mime=_guess_mime(vision_raw),
            )
            items = payload.get("items") if isinstance(payload, dict) else None
            if isinstance(items, list) and items:
                normalized = [_normalize_detection(item, index) for index, item in enumerate(items[:6])]
                return _resolve_bbox_overlaps(normalized)
        except Exception as exc:
            logger.warning("outfit_detect_groq_failed", error=str(exc))

    return _heuristic_zone_detections(raw)


def _normalize_detection(item: dict[str, Any], index: int) -> dict[str, Any]:
    bbox = item.get("bbox") or {}
    if not isinstance(bbox, dict):
        bbox = {}
    x = _clamp01(float(bbox.get("x", 0.1)))
    y = _clamp01(float(bbox.get("y", 0.1)))
    w = _clamp01(float(bbox.get("w", 0.8)))
    h = _clamp01(float(bbox.get("h", 0.8)))
    if x + w > 1:
        w = max(0.15, 1 - x)
    if y + h > 1:
        h = max(0.15, 1 - y)
    label = str(item.get("label_uz") or item.get("label") or f"Buyum {index + 1}")
    raw_cat = str(item.get("category") or "").strip()
    category = normalize_visual_category(label_uz=label, category=raw_cat)
    color = normalize_color_uz(str(item.get("color") or "").strip()) or None
    material = str(item.get("material") or "").strip() or None
    search_query = str(item.get("search_query") or "").strip() or f"{color or ''} {label}".strip()
    if color and color not in search_query.lower():
        search_query = f"{color} {search_query}".strip()
    return {
        "id": str(item.get("id") or index + 1),
        "label_uz": label,
        "category": category,
        "category_slug": category,
        "color": color,
        "material": material,
        "search_query": search_query,
        "bbox": {"x": x, "y": y, "w": w, "h": h},
    }


def _heuristic_zone_detections(raw: bytes) -> list[dict[str, Any]]:
    """Fallback: upper / middle / lower body zones (common outfit photo layout)."""
    fallback = _local_fallback_from_bytes(raw)
    color = fallback.get("color") or ""
    zones = [
        ("Kurtka", "jacket", {"x": 0.08, "y": 0.05, "w": 0.84, "h": 0.28}),
        ("Sviter / ko'ylak", "top", {"x": 0.12, "y": 0.2, "w": 0.76, "h": 0.2}),
        ("Shim", "pants", {"x": 0.1, "y": 0.42, "w": 0.8, "h": 0.26}),
        ("Oyoq kiyim", "shoes", {"x": 0.12, "y": 0.7, "w": 0.76, "h": 0.26}),
    ]
    items = [
        {
            "id": str(i + 1),
            "label_uz": label,
            "category": cat,
            "color": color.replace("#", "") if color.startswith("#") else color,
            "material": fallback.get("material"),
            "search_query": f"{color} {label}".strip(),
            "bbox": bbox,
        }
        for i, (label, cat, bbox) in enumerate(zones)
    ]
    return _resolve_bbox_overlaps(items)


def _attributes_to_query(attrs: dict[str, Any]) -> str:
    parts = [str(attrs.get("category") or ""), str(attrs.get("color") or ""), str(attrs.get("material") or "")]
    parts.extend(str(t) for t in (attrs.get("style_tags") or []) if t)
    return " ".join(p for p in parts if p).strip() or "kiyim"


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _bbox_area(bbox: dict[str, float]) -> float:
    return float(bbox["w"]) * float(bbox["h"])


def _bbox_iou(a: dict[str, float], b: dict[str, float]) -> float:
    x0 = max(a["x"], b["x"])
    y0 = max(a["y"], b["y"])
    x1 = min(a["x"] + a["w"], b["x"] + b["w"])
    y1 = min(a["y"] + a["h"], b["y"] + b["h"])
    if x1 <= x0 or y1 <= y0:
        return 0.0
    inter = (x1 - x0) * (y1 - y0)
    union = _bbox_area(a) + _bbox_area(b) - inter
    return inter / union if union > 0 else 0.0


def _is_nested_bbox(inner: dict[str, float], outer: dict[str, float], margin: float = 0.02) -> bool:
    return (
        inner["x"] >= outer["x"] - margin
        and inner["y"] >= outer["y"] - margin
        and inner["x"] + inner["w"] <= outer["x"] + outer["w"] + margin
        and inner["y"] + inner["h"] <= outer["y"] + outer["h"] + margin
        and _bbox_area(inner) < _bbox_area(outer) * 0.92
    )


def _resolve_bbox_overlaps(items: list[dict[str, Any]], *, min_gap: float = 0.012) -> list[dict[str, Any]]:
    """Push apart accidental overlaps; keep intentional nesting (e.g. shirt under jacket)."""
    if len(items) < 2:
        return items

    boxes = [dict(item["bbox"]) for item in items]
    order = sorted(range(len(boxes)), key=lambda i: _bbox_area(boxes[i]), reverse=True)

    for oi, i in enumerate(order):
        for j in order[oi + 1 :]:
            a, b = boxes[i], boxes[j]
            if _bbox_iou(a, b) < 0.08:
                continue
            if _is_nested_bbox(a, b) or _is_nested_bbox(b, a):
                continue

            smaller, larger = (i, j) if _bbox_area(a) <= _bbox_area(b) else (j, i)
            s, l = boxes[smaller], boxes[larger]
            overlap_y = min(s["y"] + s["h"], l["y"] + l["h"]) - max(s["y"], l["y"])
            overlap_x = min(s["x"] + s["w"], l["x"] + l["w"]) - max(s["x"], l["x"])

            if overlap_y > overlap_x and overlap_y > 0:
                if s["y"] + s["h"] / 2 <= l["y"] + l["h"] / 2:
                    s["y"] = max(0.0, l["y"] - s["h"] - min_gap)
                else:
                    s["y"] = min(1.0 - s["h"], l["y"] + l["h"] + min_gap)
            elif overlap_x > 0:
                if s["x"] + s["w"] / 2 <= l["x"] + l["w"] / 2:
                    s["x"] = max(0.0, l["x"] - s["w"] - min_gap)
                else:
                    s["x"] = min(1.0 - s["w"], l["x"] + l["w"] + min_gap)

            boxes[smaller] = {
                "x": _clamp01(s["x"]),
                "y": _clamp01(s["y"]),
                "w": _clamp01(s["w"]),
                "h": _clamp01(s["h"]),
            }

    resolved: list[dict[str, Any]] = []
    for item, bbox in zip(items, boxes):
        merged = dict(item)
        merged["bbox"] = bbox
        resolved.append(merged)
    return resolved


def _downscale_image_bytes(raw: bytes, *, max_edge: int = 768) -> bytes:
    """Smaller payload for vision API — faster upload + inference."""
    pil = Image.open(io.BytesIO(raw)).convert("RGB")
    w, h = pil.size
    scale = min(1.0, max_edge / max(w, h))
    if scale < 1.0:
        pil = pil.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=84)
    return buf.getvalue()


def _apply_crop_color_to_detection(det: dict[str, Any], crop: Image.Image) -> dict[str, Any]:
    """Per-piece color: model (Groq) + crop pixels; crop wins only when model empty."""
    crop_color = color_uz_from_image(crop)
    model_color = normalize_color_uz(str(det.get("color") or ""))
    final_color = model_color or crop_color
    if model_color and crop_color and model_color != crop_color:
        # Kichik crop / fon aralashuvi — model rangini saqlaymiz
        final_color = model_color
    label = str(det.get("label_uz") or "kiyim")
    search_query = str(det.get("search_query") or label).strip()
    if final_color:
        if final_color not in search_query.lower():
            search_query = f"{final_color} {search_query}".strip()
    return {
        **det,
        "color": final_color,
        "crop_color": crop_color,
        "search_query": search_query,
    }


def crop_bbox(pil: Image.Image, bbox: dict[str, float], *, padding: float = 0.04) -> Image.Image:
    w, h = pil.size
    x = _clamp01(float(bbox.get("x", 0)) - padding)
    y = _clamp01(float(bbox.get("y", 0)) - padding)
    bw = min(1.0 - x, float(bbox.get("w", 1)) + padding * 2)
    bh = min(1.0 - y, float(bbox.get("h", 1)) + padding * 2)
    x0 = int(x * w)
    y0 = int(y * h)
    x1 = max(x0 + 24, int((x + bw) * w))
    y1 = max(y0 + 24, int((y + bh) * h))
    return pil.crop((x0, y0, min(w, x1), min(h, y1)))


def thumbnail_data_url(pil: Image.Image) -> str:
    thumb = pil.copy()
    thumb.thumbnail((220, 220))
    buf = io.BytesIO()
    thumb.save(buf, format="JPEG", quality=85)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def _fuse_taobao_rank(
    visual_rows: list[dict[str, Any]],
    text_rows: list[dict[str, Any]],
    *,
    limit: int,
) -> list[dict[str, Any]]:
    """Merge image-similarity + text hits (Taobao-style re-rank)."""
    scores: dict[str, tuple[int, dict[str, Any]]] = {}
    for i, row in enumerate(visual_rows):
        pid = str(row.get("id") or "")
        if not pid:
            continue
        scores[pid] = (1200 - i, {**row, "match_mode": "visual"})
    for i, row in enumerate(text_rows):
        pid = str(row.get("id") or "")
        if not pid:
            continue
        if pid in scores:
            prev, data = scores[pid]
            scores[pid] = (prev + 600 - i, {**data, **row, "match_mode": "hybrid"})
        else:
            scores[pid] = (600 - i, {**row, "match_mode": "text"})
    ordered = sorted(scores.values(), key=lambda x: x[0], reverse=True)
    return [row for _, row in ordered[:limit]]


def _product_blob(row: dict[str, Any]) -> str:
    attrs = row.get("attributes") if isinstance(row.get("attributes"), dict) else {}
    return " ".join(
        str(x or "")
        for x in (
            row.get("name"),
            row.get("category"),
            attrs.get("category"),
            attrs.get("sub_category"),
            attrs.get("root_category"),
            row.get("description"),
        )
    ).lower()


_SLOT_HARD_BLOCK: dict[str, tuple[str, ...]] = {
    "belt": (
        "mato",
        "to'qimachilik",
        "toqimachilik",
        "ko'rpa",
        "korpa",
        "pardabop",
        "rulon",
        "tufli",
        "krossovka",
        "poyabzal",
        "shoe",
        "sandal",
        "bolalar",
        "maktab",
        "forma",
        "atir",
        "parfyum",
        "sarpo",
        "kelin",
        "gazmol",
    ),
    "kamar": (
        "mato",
        "to'qimachilik",
        "ko'rpa",
        "pardabop",
        "tufli",
        "krossovka",
        "poyabzal",
        "bolalar",
        "maktab",
        "atir",
    ),
    "shoes": ("mato", "ko'rpa", "kamar", "belbog", "ko'ylak", "kurtka", "shim"),
    "poyabzal": ("mato", "ko'rpa", "kamar", "belbog", "ko'ylak"),
    "pants": ("soat", "watch", "qo'l soat", "smart", "atir", "parfyum", "mato", "ko'rpa", "tufli", "krossovka"),
    "shim": ("soat", "watch", "qo'l soat", "smart", "atir", "parfyum", "mato", "ko'rpa", "tufli", "krossovka"),
    "jacket": ("soat", "watch", "tufli", "krossovka", "mato", "ko'rpa", "atir"),
    "kurtka": ("soat", "watch", "tufli", "krossovka", "mato", "ko'rpa"),
    "shirt": ("soat", "watch", "shim", "tufli", "mato", "ko'rpa"),
    "top": ("soat", "watch", "tufli", "mato", "ko'rpa", "atir"),
}


def _filter_slot_products(rows: list[dict[str, Any]], filters: dict[str, Any]) -> list[dict[str, Any]]:
    """Drop cross-category noise (mato, tufli, bolalar…) — strict slots require keyword in title."""
    if not rows:
        return []
    strict = bool(filters.get("strict_slot"))
    slot_key = str(filters.get("slot_key") or "").lower()
    keywords = [str(k).lower() for k in (filters.get("slot_category_keywords") or []) if str(k).strip()]
    exclude = [str(p).lower() for p in (filters.get("exclude_name_patterns") or []) if len(str(p)) >= 3]
    hard_block = list(_SLOT_HARD_BLOCK.get(slot_key, ()))

    matched: list[dict[str, Any]] = []
    for row in rows:
        hay = _product_blob(row)
        if any(bad in hay for bad in exclude):
            continue
        if any(bad in hay for bad in hard_block):
            continue
        if keywords:
            if any(kw in hay for kw in keywords):
                matched.append(row)
            elif int(row.get("visual_match_pct") or 0) >= 52 and row.get("visual_match"):
                if not any(bad in hay for bad in hard_block):
                    matched.append(row)
        elif not strict:
            matched.append(row)

    if not matched and rows and strict:
        # Vizual o'xshashlik yuqori — slot kalit so'zisiz ham (Taobao crop match)
        for row in rows:
            if int(row.get("visual_match_pct") or 0) >= 58 and row.get("visual_match"):
                hay = _product_blob(row)
                if not any(bad in hay for bad in hard_block + exclude):
                    matched.append(row)

    return matched


def _rank_visual_products(rows: list[dict[str, Any]], filters: dict[str, Any]) -> list[dict[str, Any]]:
    color_terms = [t.lower() for t in (filters.get("color_terms") or color_search_terms(filters.get("color")))]
    exclude = [str(p).lower() for p in (filters.get("exclude_name_patterns") or []) if len(str(p)) >= 3]

    def score(row: dict[str, Any]) -> int:
        hay = f"{row.get('name', '')} {row.get('description', '')}".lower()
        pts = int(row.get("visual_match_pct") or 0)
        for term in color_terms:
            if term in hay:
                pts += 12
        for bad in exclude:
            if bad in hay:
                pts -= 25
        if row.get("is_fallback"):
            pts -= 2
        return pts

    return sorted(rows, key=score, reverse=True)


def _prefer_color_aligned(rows: list[dict[str, Any]], filters: dict[str, Any]) -> list[dict[str, Any]]:
    """When crop color is known, list color-matching titles first (same look)."""
    color_terms = [t.lower() for t in (filters.get("color_terms") or color_search_terms(filters.get("color")))]
    if not color_terms or len(rows) < 2:
        return rows
    aligned: list[dict[str, Any]] = []
    rest: list[dict[str, Any]] = []
    for row in rows:
        hay = _product_blob(row)
        if any(term in hay for term in color_terms):
            aligned.append(row)
        else:
            rest.append(row)
    if aligned:
        return aligned + rest
    return rows


async def _products_from_matches(
    marketplace_repo: MarketplaceRepository,
    matches: list,
) -> list[dict[str, Any]]:
    from app.interfaces.api.serializers import product_to_dict

    products: list[dict] = []
    for match in matches:
        product = await marketplace_repo.get_product_by_id(UUID(match.id))
        if product:
            products.append(product_to_dict(product))
    return products


async def _resolve_visual_matches_fast(
    product_repo: ProductRepo,
    marketplace_repo: MarketplaceRepository,
    *,
    filters: dict[str, Any],
    vision: dict[str, Any],
    det: dict[str, Any],
    limit: int,
    crop_bytes: bytes | None = None,
) -> tuple[list[dict[str, Any]], bool]:
    """Fast path: parallel crop visual + keyword slot — no OpenAI embed / hybrid."""
    strict_filters = filters if filters.get("strict_slot") else build_strict_slot_filters(
        det=det, vision=vision, intent_text=str(filters.get("text") or "")
    )
    min_p = filters.get("min_price")
    max_p = filters.get("max_price")
    hint = str(det.get("search_query") or det.get("label_uz") or "fashion clothing")

    async def _visual_rows() -> list[dict[str, Any]]:
        if not crop_bytes:
            return []
        try:
            return await taobao_search_by_crop(
                product_repo,
                marketplace_repo,
                crop_bytes,
                limit=limit,
                min_price=float(min_p) if min_p is not None else None,
                max_price=float(max_p) if max_p is not None else None,
                search_hint=hint,
                fast=True,
            )
        except Exception as exc:
            logger.warning("visual_signature_search_failed", error=str(exc))
            return []

    async def _keyword_rows() -> list[dict[str, Any]]:
        if not strict_filters.get("slot_key"):
            return []
        matches = await product_repo.keyword_slot_search(
            strict_filters,
            limit=limit,
            min_price=float(min_p) if min_p is not None else None,
            max_price=float(max_p) if max_p is not None else None,
            require_color=False,
        )
        return await _products_from_matches(marketplace_repo, matches)

    # One session per call — do not asyncio.gather DB work on the same AsyncSession.
    visual_rows = await _visual_rows()
    keyword_rows = await _keyword_rows()

    visual_filtered = _prefer_color_aligned(
        _filter_slot_products(_rank_visual_products(visual_rows, strict_filters), strict_filters),
        strict_filters,
    )
    keyword_filtered = _prefer_color_aligned(
        _filter_slot_products(_rank_visual_products(keyword_rows, strict_filters), strict_filters),
        strict_filters,
    )

    if visual_filtered:
        return visual_filtered[:limit], True
    if keyword_filtered:
        return keyword_filtered[:limit], False
    return [], True


async def _resolve_visual_matches(
    product_repo: ProductRepo,
    marketplace_repo: MarketplaceRepository,
    *,
    vector: list[float],
    filters: dict[str, Any],
    vision: dict[str, Any],
    det: dict[str, Any],
    limit: int,
    crop_bytes: bytes | None = None,
    fast: bool = False,
) -> tuple[list[dict[str, Any]], bool]:
    """Taobao pipeline: visual crop match → text hybrid → relaxed vector → keyword."""
    if fast:
        return await _resolve_visual_matches_fast(
            product_repo,
            marketplace_repo,
            filters=filters,
            vision=vision,
            det=det,
            limit=limit,
            crop_bytes=crop_bytes,
        )

    from app.interfaces.api.serializers import product_to_dict

    strict_filters = filters if filters.get("strict_slot") else build_strict_slot_filters(
        det=det, vision=vision, intent_text=str(filters.get("text") or "")
    )

    min_p = filters.get("min_price")
    max_p = filters.get("max_price")

    visual_rows: list[dict[str, Any]] = []
    if crop_bytes:
        try:
            hint = str(det.get("search_query") or det.get("label_uz") or "fashion clothing")
            visual_rows = await taobao_search_by_crop(
                product_repo,
                marketplace_repo,
                crop_bytes,
                limit=limit,
                min_price=float(min_p) if min_p is not None else None,
                max_price=float(max_p) if max_p is not None else None,
                search_hint=hint,
            )
        except Exception as exc:
            logger.warning("visual_signature_search_failed", error=str(exc))

    exact: list[dict[str, Any]] = []
    for match in await product_repo.hybrid_search(
        vector,
        strict_filters,
        limit=limit,
        min_price=float(min_p) if min_p is not None else None,
        max_price=float(max_p) if max_p is not None else None,
    ):
        product = await marketplace_repo.get_product_by_id(UUID(match.id))
        if product:
            exact.append(product_to_dict(product))

    text_ranked = _prefer_color_aligned(
        _filter_slot_products(
            _rank_visual_products(exact, strict_filters) if exact else [],
            strict_filters,
        ),
        strict_filters,
    )

    visual_filtered = _prefer_color_aligned(
        _filter_slot_products(
            _rank_visual_products(visual_rows, strict_filters) if visual_rows else [],
            strict_filters,
        ),
        strict_filters,
    )

    if text_ranked and visual_filtered:
        fused = _fuse_taobao_rank(visual_filtered, text_ranked, limit=limit)
        return fused, not bool(exact)

    if text_ranked:
        return text_ranked[:limit], not bool(exact)

    if visual_filtered:
        return visual_filtered[:limit], True

    # Relaxed pass: keep slot keywords but allow broader vector match
    relaxed_filters = dict(strict_filters)
    relaxed_filters["strict_slot"] = False
    for distance_cap in (0.85, 0.92, 0.97):
        neighbors = await _products_from_matches(
            marketplace_repo,
            await product_repo.vector_similarity_fallback(
                vector,
                limit=limit,
                max_cosine_distance=distance_cap,
                category_hint=str(det.get("category_slug") or det.get("category") or ""),
                color_hint=str(det.get("color") or vision.get("color") or ""),
                style_tags=list(vision.get("style_tags") or []),
                metadata_filters=relaxed_filters,
            ),
        )
        if neighbors:
            for row in neighbors:
                row["is_fallback"] = True
            return _rank_visual_products(neighbors, strict_filters)[:limit], True

    for distance_cap in (0.78, 0.88, 0.95, 0.98):
        neighbors = await _products_from_matches(
            marketplace_repo,
            await product_repo.vector_similarity_fallback(
                vector,
                limit=limit,
                max_cosine_distance=distance_cap,
                category_hint=str(det.get("category") or vision.get("category") or ""),
                color_hint=str(det.get("color") or vision.get("color") or ""),
                style_tags=list(vision.get("style_tags") or []),
                metadata_filters={**strict_filters, "strict_slot": False},
            ),
        )
        if neighbors:
            for row in neighbors:
                row["is_fallback"] = True
            ranked = _filter_slot_products(_rank_visual_products(neighbors, strict_filters), strict_filters)
            if ranked:
                return ranked[:limit], True

    keyword_rows = await _products_from_matches(
        marketplace_repo,
        await product_repo.keyword_slot_search(
            strict_filters,
            limit=limit * 2,
            min_price=float(min_p) if min_p is not None else None,
            max_price=float(max_p) if max_p is not None else None,
            require_color=bool(strict_filters.get("color_terms")),
        ),
    )
    if keyword_rows:
        for row in keyword_rows:
            row["is_fallback"] = True
        ranked = _filter_slot_products(_rank_visual_products(keyword_rows, strict_filters), strict_filters)
        if ranked:
            return ranked[:limit], True

    return [], False


def _order_items_by_stylist_ids(items: list[dict], selected_ids: list[str]) -> list[dict]:
    if not selected_ids:
        return items
    by_id = {str(p.get("id")): p for p in items if p.get("id")}
    ordered = [by_id[i] for i in selected_ids if i in by_id]
    seen = {str(p.get("id")) for p in ordered}
    for row in items:
        pid = str(row.get("id") or "")
        if pid and pid not in seen:
            ordered.append(row)
            seen.add(pid)
    return ordered


async def search_look_from_text(
    session: AsyncSession,
    text: str,
    *,
    limit: int = 24,
) -> dict[str, Any]:
    """Text look queries — vector catalog + elite stylist composition (no static fallbacks)."""
    query = (text or "").strip()
    if not query:
        return {"items": [], "total": 0, "assistant_text": "", "mode": "look_text"}

    look_intent = parse_look_intent(query)
    min_p, max_p = parse_budget_from_text(query)
    if look_intent.get("max_price") is not None:
        max_p = look_intent["max_price"]
    category = parse_category_hint(query) or look_intent.get("category_hint")
    search_q = build_catalog_search_query(query, category)

    embedder = EmbeddingClient()
    product_repo = ProductRepo(session)
    marketplace_repo = MarketplaceRepository(session)
    filters: dict[str, Any] = {"text": search_q}
    if category:
        filters["category_hint"] = category
    sale_type = parse_sale_type(query)
    if sale_type in ("Chakana", "Optom"):
        filters["sale_type"] = sale_type

    vector = await embedder.embed(search_q)
    min_f = float(min_p) if min_p is not None else None
    max_f = float(max_p) if max_p is not None else None
    matches = await product_repo.hybrid_search(vector, filters, limit=limit, min_price=min_f, max_price=max_f)

    items: list[dict[str, Any]] = []
    for m in matches:
        full = await marketplace_repo.get_product_by_id(UUID(str(m.id)))
        if full:
            items.append(product_to_dict(full))

    used_vector = False
    if not items:
        used_vector = True
        for max_dist in (0.82, 0.9, 0.95):
            neighbors = await product_repo.vector_similarity_fallback(
                vector,
                limit=max(limit, 24),
                max_cosine_distance=max_dist,
                category_hint=category or "",
            )
            items = await _products_from_matches(marketplace_repo, neighbors)
            if items:
                break
        for row in items:
            row["is_fallback"] = True

    exact_only = [p for p in items if not p.get("is_fallback")]
    jonli = build_jonli_katalog_natijasi(exact_items=exact_only, vector_neighbors=items)
    composed = await synthesize_visual_search_narrative(
        query_label=query,
        vision={},
        catalog_items=list(jonli.get("vector_neighbors") or items),
        exact_items=exact_only,
        budget_max=max_p,
        user_intent=query,
    )
    selected_ids = list(composed.get("selected_product_ids") or [])
    ordered = _order_items_by_stylist_ids(items, selected_ids)

    return {
        "items": ordered[:limit],
        "total": len(ordered),
        "page": 1,
        "mode": "look_text",
        "query": query,
        "look_intent": look_intent,
        "is_fallback": used_vector or bool(jonli.get("is_fallback")),
        "jonli_katalog_natijasi": jonli,
        "assistant_text": str(composed.get("assistant_text") or ""),
        "selected_product_ids": selected_ids,
        "look_groups": composed.get("look_groups") or [],
    }


def _fast_assistant_text(detected_payloads: list[dict[str, Any]]) -> str:
    """Per-slot summary — avoids mixing kamar + kurtka + random fallback names."""
    if not detected_payloads:
        return "Bazada mos mahsulot topilmadi. Boshqa rasm yoki matn bilan qidiring."

    parts: list[str] = []
    for block in detected_payloads:
        prods = block.get("products") or []
        if not prods:
            continue
        label = str(block.get("label_uz") or "Buyum")
        names = [str(p.get("name") or "").strip() for p in prods[:2] if p.get("name")]
        if names:
            parts.append(f"{label} ({len(prods)}): {', '.join(names)}")
        else:
            parts.append(f"{label} — {len(prods)} ta")

    if parts:
        return "Rasm bo'yicha topildi — " + " · ".join(parts)
    return "Rasm tahlil qilindi. Nuqta yoki chip tanlab aniqroq qidiring."


async def search_outfit_from_image(
    session: AsyncSession,
    raw: bytes,
    *,
    limit_per_item: int = 8,
    max_items: int = 6,
    intent_text: str | None = None,
    fast: bool = True,
) -> dict[str, Any]:
    if fast:
        max_items = min(max_items, 4)
        limit_per_item = min(limit_per_item, 5)

    pil = Image.open(io.BytesIO(raw)).convert("RGB")
    detections = (await detect_outfit_items(raw))[:max_items]
    embedder = EmbeddingClient()
    product_repo = ProductRepo(session)
    marketplace_repo = MarketplaceRepository(session)

    detected_payloads: list[dict[str, Any]] = []
    flat_items: list[dict] = []
    seen: set[str] = set()

    async def _process_detection(det: dict[str, Any]) -> dict[str, Any]:
        """Each detection gets its own DB session (safe with asyncio.gather)."""
        async with AsyncSessionFactory() as item_session:
            return await _process_detection_with_session(det, item_session)

    async def _process_detection_with_session(det: dict[str, Any], item_session: AsyncSession) -> dict[str, Any]:
        item_product_repo = ProductRepo(item_session)
        item_marketplace_repo = MarketplaceRepository(item_session)
        crop = crop_bbox(pil, det["bbox"])
        det = _apply_crop_color_to_detection(det, crop)
        crop_bytes = io.BytesIO()
        quality = 82 if fast else 88
        crop.save(crop_bytes, format="JPEG", quality=quality)
        crop_raw = crop_bytes.getvalue()

        vision: dict[str, Any]
        if fast:
            vision = {
                "color": det.get("color"),
                "crop_color": det.get("crop_color"),
                "category": det.get("category"),
                "material": det.get("material"),
            }
            search_text = str(det.get("search_query") or det.get("label_uz") or "kiyim").strip()
        else:
            try:
                vision = await GeminiClient().extract_attributes(crop_raw)
            except Exception:
                vision = _local_fallback_from_bytes(crop_raw)

            vision_color = normalize_color_uz(str((vision or {}).get("color") or ""))
            if vision_color:
                det = {**det, "color": vision_color}
                if vision_color not in str(det.get("search_query") or "").lower():
                    det["search_query"] = f"{vision_color} {det.get('search_query') or det.get('label_uz') or ''}".strip()

            fingerprint = await build_taobao_fingerprint(
                crop_raw,
                label_uz=str(det.get("label_uz") or ""),
                category=str(det.get("category") or ""),
            )
            search_parts = [p for p in (fingerprint, str(det.get("search_query") or ""), _attributes_to_query(vision)) if p]
            search_text = " ".join(dict.fromkeys(search_parts)).strip()
            det = {**det, "search_query": search_text}

        filters = build_strict_slot_filters(
            det=det,
            vision=vision if isinstance(vision, dict) else {},
            intent_text=intent_text,
            photo_mode=True,
        )
        filters["text"] = search_text

        if fast:
            products, used_vector = await _resolve_visual_matches(
                item_product_repo,
                item_marketplace_repo,
                vector=[],
                filters=filters,
                vision=vision,
                det=det,
                limit=limit_per_item,
                crop_bytes=crop_raw,
                fast=True,
            )
        else:
            vector = await embedder.embed(search_text)
            products, used_vector = await _resolve_visual_matches(
                item_product_repo,
                item_marketplace_repo,
                vector=vector,
                filters=filters,
                vision=vision,
                det=det,
                limit=limit_per_item,
                crop_bytes=crop_raw,
                fast=False,
            )
        products = _prefer_color_aligned(_filter_slot_products(products, filters), filters)

        return {
            "det": det,
            "crop": crop,
            "search_text": search_text,
            "vision": vision,
            "products": products,
            "used_vector": used_vector,
        }

    processed = await asyncio.gather(*[_process_detection(det) for det in detections], return_exceptions=True)

    for result in processed:
        if isinstance(result, BaseException):
            logger.warning("outfit_item_process_failed", error=repr(result))
            continue
        det = result["det"]
        crop = result["crop"]
        search_text = result["search_text"]
        vision = result["vision"]
        products = result["products"]
        used_vector = result["used_vector"]

        for row in products:
            pid = str(row["id"])
            if pid not in seen:
                seen.add(pid)
                flat_items.append(row)

        detected_payloads.append(
            {
                "id": str(det["id"]),
                "label_uz": det["label_uz"],
                "category": det.get("category"),
                "color": det.get("color"),
                "material": det.get("material"),
                "search_query": search_text,
                "bbox": det["bbox"],
                "thumbnail_url": thumbnail_data_url(crop),
                "vision": vision if not fast else None,
                "products": products,
                "total": len(products),
                "is_fallback": used_vector,
            }
        )

    # Global visual fallback only when detection found nothing — never mix random catalog into slots.
    if not flat_items and not detected_payloads:
        global_rows = await taobao_search_by_crop(
            product_repo,
            marketplace_repo,
            raw,
            limit=limit_per_item * max(2, max_items),
            search_hint=intent_text or "fashion outfit clothing photo",
            fast=fast,
        )
        for row in global_rows:
            pid = str(row["id"])
            if pid not in seen:
                seen.add(pid)
                flat_items.append(row)

    primary_vision = detected_payloads[0]["vision"] if detected_payloads else _local_fallback_from_bytes(raw)
    query_label = (intent_text or "").strip() or ", ".join(d["label_uz"] for d in detected_payloads) or "Rasm bo'yicha qidiruv"
    exact_only = [p for p in flat_items if not p.get("is_fallback")]
    jonli = build_jonli_katalog_natijasi(exact_items=exact_only, vector_neighbors=flat_items)
    look_intent = parse_look_intent(intent_text or query_label)
    _, budget_max = parse_budget_from_text(intent_text or "")

    if fast:
        assistant_text = _fast_assistant_text(detected_payloads)
        primary_products = (detected_payloads[0].get("products") or []) if detected_payloads else flat_items
        selected_ids = [str(p["id"]) for p in primary_products[:8] if p.get("id")]
        look_groups: list[Any] = []
    else:
        composed = await synthesize_visual_search_narrative(
            query_label=query_label,
            vision=primary_vision if isinstance(primary_vision, dict) else {},
            catalog_items=flat_items,
            exact_items=exact_only,
            budget_max=budget_max,
            user_intent=intent_text or query_label,
        )
        assistant_text = str(composed.get("assistant_text") or "")
        selected_ids = list(composed.get("selected_product_ids") or [])
        look_groups = composed.get("look_groups") or []

    display_items = _order_items_by_stylist_ids(flat_items, selected_ids)

    return {
        "items": display_items[: limit_per_item * max_items],
        "total": len(display_items),
        "page": 1,
        "vision": primary_vision if not fast else {},
        "query_label": query_label,
        "detected_items": detected_payloads,
        "mode": "outfit_multi_fast" if fast else "outfit_multi",
        "is_fallback": bool(jonli.get("is_fallback")),
        "jonli_katalog_natijasi": jonli,
        "assistant_text": assistant_text,
        "selected_product_ids": selected_ids,
        "look_groups": look_groups,
        "look_intent": look_intent,
    }


def _decode_crop_base64(crop_base64: str | None) -> bytes | None:
    if not crop_base64 or not str(crop_base64).strip():
        return None
    raw = str(crop_base64).strip()
    if raw.startswith("data:") and "," in raw:
        raw = raw.split(",", 1)[1]
    try:
        return base64.b64decode(raw)
    except (binascii.Error, ValueError):
        return None


async def refine_visual_search_category(
    session: AsyncSession,
    *,
    label_uz: str,
    search_query: str,
    category: str | None = None,
    color: str | None = None,
    material: str | None = None,
    intent_text: str | None = None,
    min_price: int | None = None,
    max_price: int | None = None,
    limit: int = 24,
    crop_base64: str | None = None,
) -> dict[str, Any]:
    """Re-run search for one chip — image-first (Taobao), then text slot."""
    category_slug = normalize_visual_category(label_uz=label_uz, category=category or "")
    det = {
        "label_uz": label_uz,
        "category": category_slug,
        "category_slug": category_slug,
        "search_query": search_query,
        "color": color,
        "material": material,
    }
    embedder = EmbeddingClient()
    product_repo = ProductRepo(session)
    marketplace_repo = MarketplaceRepository(session)

    crop_bytes = _decode_crop_base64(crop_base64)
    if crop_bytes:
        try:
            pil_crop = Image.open(io.BytesIO(crop_bytes)).convert("RGB")
            det = _apply_crop_color_to_detection(det, pil_crop)
            color = det.get("color")
            search_query = str(det.get("search_query") or search_query)
        except Exception as exc:
            logger.warning("refine_crop_color_failed", error=str(exc))

    if crop_bytes:
        try:
            hint = (search_query or "").strip() or label_uz
            visual_hits = await taobao_search_by_crop(
                product_repo,
                marketplace_repo,
                crop_bytes,
                limit=limit,
                min_price=float(min_price) if min_price is not None else None,
                max_price=float(max_price) if max_price is not None else None,
                search_hint=hint,
                fast=True,
            )
            if visual_hits:
                filters_pre = build_strict_slot_filters(
                    det=det,
                    vision={"color": det.get("color")},
                    intent_text=intent_text,
                    photo_mode=True,
                )
                ranked = _prefer_color_aligned(
                    _filter_slot_products(_rank_visual_products(visual_hits, filters_pre), filters_pre),
                    filters_pre,
                )
                if ranked:
                    return {
                        "products": ranked[:limit],
                        "total": len(ranked[:limit]),
                        "category": category_slug,
                        "selected_category": category_slug,
                        "label_uz": label_uz,
                        "is_fallback": False,
                        "match_mode": "visual",
                    }
        except Exception as exc:
            logger.warning("refine_visual_crop_failed", error=str(exc))

    search_text = (search_query or "").strip() or f"{color or ''} {label_uz}".strip() or label_uz
    filters = build_strict_slot_filters(
        det=det,
        vision={"color": color, "material": material, "category": category_slug},
        intent_text=intent_text,
        photo_mode=True,
    )
    filters["text"] = search_text
    if min_price is not None:
        filters["min_price"] = min_price
    if max_price is not None:
        filters["max_price"] = max_price

    if crop_bytes:
        products, used_vector = await _resolve_visual_matches(
            product_repo,
            marketplace_repo,
            vector=[],
            filters=filters,
            vision={"color": color, "material": material, "category": category_slug},
            det=det,
            limit=limit,
            crop_bytes=crop_bytes,
            fast=True,
        )
    else:
        vector = await embedder.embed(search_text)
        products, used_vector = await _resolve_visual_matches(
            product_repo,
            marketplace_repo,
            vector=vector,
            filters=filters,
            vision={"color": color, "material": material, "category": category_slug},
            det=det,
            limit=limit,
            crop_bytes=None,
            fast=False,
        )
    products = _prefer_color_aligned(_filter_slot_products(products, filters), filters)

    if not products and filters.get("slot_key"):
        kw_matches = await product_repo.keyword_slot_search(
            filters,
            limit=limit,
            min_price=float(min_price) if min_price is not None else None,
            max_price=float(max_price) if max_price is not None else None,
        )
        products = await _products_from_matches(marketplace_repo, kw_matches)
        products = _prefer_color_aligned(_filter_slot_products(products, filters), filters)
        used_vector = False

    return {
        "products": products,
        "total": len(products),
        "category": category_slug,
        "selected_category": category_slug,
        "label_uz": label_uz,
        "is_fallback": used_vector,
    }
