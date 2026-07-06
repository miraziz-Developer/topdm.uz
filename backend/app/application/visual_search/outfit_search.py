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
from app.application.visual_search.bbox_refine import (
    _skin_ratio_in_bbox,
    build_body_part_detections,
    clamp_bbox_in_frame,
    estimate_foreground_product_bbox,
    estimate_person_silhouette_bbox,
    filter_sky_detections,
    has_wearable_person,
    is_horizontal_strip_bbox,
    is_invalid_outfit_bbox,
    is_outfit_portrait_photo,
    looks_like_studio_product_backdrop,
    merge_fashion_slots,
    merge_groq_metadata,
    person_heuristic_zones,
    refine_outfit_detections,
    tighten_bbox_to_content,
)
from app.application.visual_search.image_panels import (
    ImagePanel,
    crop_panel,
    find_vertical_panels,
    map_detections_to_global,
    panel_product_bbox,
)
from app.application.visual_search.category_map import normalize_visual_category
from app.application.visual_search.crop_preprocess import prepare_taobao_crop
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


_OUTFIT_HEURISTIC_LABELS = frozenset({"Kurtka", "Sviter / ko'ylak", "Yuqori kiyim", "Shim", "Oyoq kiyim"})

# Taobao-style: query vector from crop pixels only — no label/category/color text in embedding hint
PURE_VISUAL_SEARCH_HINT = "visual product image patch similarity"

_CATEGORY_LABEL_UZ: dict[str, str] = {
    "shoes": "Oyoq kiyim",
    "jacket": "Kurtka",
    "pants": "Shim",
    "shirt": "Ko'ylak",
    "top": "Yuqori kiyim",
    "dress": "Libos",
    "belt": "Kamar",
    "bag": "Sumka",
}


def _silhouette_looks_like_standing_person(person: dict[str, float]) -> bool:
    """Odam tik turgan — baland va tor; tufli/quti kadr — keng va past."""
    aspect = float(person["w"]) / max(float(person["h"]), 0.01)
    return float(person["h"]) >= 0.48 and aspect <= 0.62


def _looks_like_outfit_photo(pil: Image.Image) -> bool:
    if not is_outfit_portrait_photo(pil):
        return False
    person = estimate_person_silhouette_bbox(pil)
    standing = _silhouette_looks_like_standing_person(person)
    cx = person["x"] + person["w"] / 2
    centered = (
        float(person["h"]) >= 0.50
        and float(person["y"]) <= 0.18
        and 0.28 <= cx <= 0.72
    )
    if not standing and not centered:
        return False
    upper = {
        "x": person["x"],
        "y": person["y"],
        "w": person["w"],
        "h": min(float(person["h"]) * 0.38, 0.34),
    }
    return _skin_ratio_in_bbox(pil, upper) >= 0.03


def _looks_like_product_photo(pil: Image.Image) -> bool:
    """Tovar foto: bitta buyum, odam emas — portret yoki landshaft."""
    if _looks_like_outfit_photo(pil):
        return False
    if looks_like_studio_product_backdrop(pil):
        return True
    w, h = pil.size
    if w <= 0 or h <= 0:
        return False
    if h / w < 1.12:
        return True
    person = estimate_person_silhouette_bbox(pil)
    aspect = float(person["w"]) / max(float(person["h"]), 0.01)
    if aspect >= 0.62 or float(person["h"]) < 0.42:
        return True
    if not _silhouette_looks_like_standing_person(person):
        return True
    if _skin_ratio_in_bbox(pil, person) < 0.025:
        return True
    return not has_wearable_person(pil)


def _should_collapse_product_fragments(pil: Image.Image, detections: list[dict[str, Any]]) -> bool:
    """YOLOS tuflini 4 parchaga bo'lib yuborsa — bitta tovar qidiruviga qayt."""
    if len(detections) < 2 or _looks_like_outfit_photo(pil):
        return False
    categories = {str(d.get("category") or d.get("id") or "") for d in detections}
    if not categories <= {"shoes", "bag", "product"}:
        return False
    areas = [
        float((d.get("bbox") or {}).get("w") or 0) * float((d.get("bbox") or {}).get("h") or 0)
        for d in detections
    ]
    return bool(areas) and max(areas) < 0.40


def _looks_like_default_body_slots(detections: list[dict[str, Any]]) -> bool:
    if len(detections) < 2:
        return False
    ids = {str(d.get("id") or d.get("slot") or "") for d in detections}
    return ids <= {"top", "pants", "shoes", "jacket"}


def _is_default_outfit_heuristic(items: list[dict[str, Any]]) -> bool:
    if len(items) != 4:
        return False
    labels = {str(item.get("label_uz") or "") for item in items}
    return labels == _OUTFIT_HEURISTIC_LABELS


def _category_label_uz(category: str) -> str:
    return _CATEGORY_LABEL_UZ.get(category, "Mahsulot")


async def _groq_outfit_detections(
    pil: Image.Image,
    vision_raw: bytes,
    groq: GroqClient,
    settings_prompt: str,
) -> list[dict[str, Any]]:
    from app.core.config import get_settings

    settings = get_settings()
    if not settings.groq_api_key:
        return []
    try:
        payload = await groq.chat_json(
            system_prompt=(
                "Fashion/product object detector for Uzbek marketplace. "
                "Output valid JSON only. category must be English slug."
            ),
            user_prompt=settings_prompt,
            vision=True,
            image_bytes=vision_raw,
            image_mime=_guess_mime(vision_raw),
        )
        items = payload.get("items") if isinstance(payload, dict) else None
        if not isinstance(items, list) or not items:
            return []
        normalized = [_normalize_detection(item, index) for index, item in enumerate(items[:6])]
        return refine_outfit_detections(pil, normalized)
    except Exception as exc:
        logger.warning("outfit_detect_groq_failed", error=str(exc))
        return []


def _pil_to_jpeg_bytes(pil: Image.Image, *, quality: int = 88) -> bytes:
    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


async def _detect_panel_outfit(panel_raw: bytes, panel_pil: Image.Image) -> list[dict[str, Any]]:
    """Bitta panel ichida lokal koordinatalarda kiyim slotlari."""
    from app.core.config import get_settings

    settings = get_settings()
    fallback = _local_fallback_from_bytes(panel_raw, panel_pil)
    color_raw = str(fallback.get("color") or "")
    color = (
        normalize_color_uz(color_raw.replace("#", ""))
        if color_raw.startswith("#")
        else normalize_color_uz(color_raw)
    )
    body_slots = build_body_part_detections(
        panel_pil,
        color=color or None,
        material=fallback.get("material"),
    )
    if (settings.fashion_detect_backend or "yolos").lower() == "yolos":
        from app.infrastructure.ai_clients.yolos_fashion_detect import detect_fashion_garments

        yolos_slots = await detect_fashion_garments(panel_raw)
        detections = merge_fashion_slots(yolos_slots, body_slots)
    else:
        detections = body_slots
    return filter_sky_detections(panel_pil, detections)


def _panel_product_detection(
    panel: ImagePanel,
    pil: Image.Image,
    panel_pil: Image.Image,
    panel_raw: bytes,
    *,
    det_id: str = "product",
) -> dict[str, Any]:
    fallback = _local_fallback_from_bytes(panel_raw, panel_pil)
    color_raw = str(fallback.get("color") or "")
    color = (
        normalize_color_uz(color_raw.replace("#", ""))
        if color_raw.startswith("#")
        else normalize_color_uz(color_raw)
    )
    category = "shoes"
    label = "Oyoq kiyim"
    if panel_pil.size[0] > 0 and panel_pil.size[1] / panel_pil.size[0] < 1.05:
        category = "shoes"
    search_query = f"{color or ''} {label}".strip() or label
    return {
        "id": det_id,
        "label_uz": "visual",
        "category": category,
        "color": color or None,
        "material": fallback.get("material"),
        "search_query": search_query,
        "bbox": panel_product_bbox(panel, pil),
        "panel": True,
        "product_panel": True,
    }


def _dedupe_collage_slots(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Har slot uchun eng katta bbox — kollajda dublikat id'larni tozalash."""
    if len(items) < 2:
        return items
    by_key: dict[str, dict[str, Any]] = {}
    for item in items:
        key = str(item.get("id") or item.get("slot") or "")
        if not key:
            continue
        if key not in by_key:
            by_key[key] = item
            continue
        prev = by_key[key]
        prev_area = _bbox_area(prev.get("bbox") or {})
        cur_area = _bbox_area(item.get("bbox") or {})
        if item.get("product_panel"):
            by_key[key] = item
        elif not prev.get("product_panel") and cur_area > prev_area:
            by_key[key] = item
    order = ("product", "top", "jacket", "pants", "shoes", "bag", "dress")
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for key in order:
        if key in by_key and key not in seen:
            out.append(by_key[key])
            seen.add(key)
    for key, item in by_key.items():
        if key not in seen:
            out.append(item)
            seen.add(key)
    return out[:6]


async def _detect_collage_items(
    raw: bytes,
    pil: Image.Image,
    panels: list[ImagePanel],
) -> list[dict[str, Any]]:
    """Vertikal kollaj: har panel alohida — koordinata drift yo'q."""
    all_dets: list[dict[str, Any]] = []
    product_count = 0

    for idx, panel in enumerate(panels):
        panel_pil = crop_panel(pil, panel)
        if panel_pil.size[0] < 24 or panel_pil.size[1] < 24:
            continue
        panel_raw = _pil_to_jpeg_bytes(panel_pil)

        is_product = _looks_like_product_photo(panel_pil) and not _looks_like_outfit_photo(panel_pil)
        is_outfit = _looks_like_outfit_photo(panel_pil)

        if is_product:
            product_count += 1
            det_id = "product" if product_count == 1 else f"product_{idx}"
            all_dets.append(_panel_product_detection(panel, pil, panel_pil, panel_raw, det_id=det_id))
            continue

        if is_outfit or is_outfit_portrait_photo(panel_pil):
            panel_dets = await _detect_panel_outfit(panel_raw, panel_pil)
            if panel_dets:
                all_dets.extend(map_detections_to_global(panel, panel_dets))
            continue

        if panel_pil.size[1] / max(panel_pil.size[0], 1) >= 1.05:
            panel_dets = await _detect_panel_outfit(panel_raw, panel_pil)
            if panel_dets:
                all_dets.extend(map_detections_to_global(panel, panel_dets))
                continue

        if _looks_like_product_photo(panel_pil):
            all_dets.append(
                _panel_product_detection(panel, pil, panel_pil, panel_raw, det_id=f"product_{idx}")
            )

    merged = _dedupe_collage_slots(all_dets)
    if merged:
        for item in merged:
            item["label_uz"] = "visual"
        logger.info("collage_panel_detect", panels=len(panels), items=len(merged))
    return merged


def _collapse_strip_detections(detections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Gorizontal qator kesishlari — bitta eng katta bbox qoldirish."""
    if len(detections) < 2:
        return detections
    strips = [d for d in detections if is_horizontal_strip_bbox(d.get("bbox"))]
    if len(strips) >= 2 and len(strips) == len(detections):
        best = max(detections, key=lambda d: _bbox_area(d.get("bbox") or {}))
        return [best]
    return [d for d in detections if not is_horizontal_strip_bbox(d.get("bbox"))] or detections


def _tight_product_bbox(pil: Image.Image) -> dict[str, float]:
    inner = estimate_foreground_product_bbox(pil)
    return clamp_bbox_in_frame(tighten_bbox_to_content(pil, inner))


async def _detect_product_photo_items(raw: bytes, pil: Image.Image) -> list[dict[str, Any]]:
    """Bitta tovar foto — YOLOS yoki siluet bbox, gorizontal chiziqlar emas."""
    from app.core.config import get_settings

    settings = get_settings()
    fallback = _local_fallback_from_bytes(raw, pil)
    color_raw = str(fallback.get("color") or "")
    color = (
        normalize_color_uz(color_raw.replace("#", ""))
        if color_raw.startswith("#")
        else normalize_color_uz(color_raw)
    )
    bbox = _tight_product_bbox(pil)
    category = "shoes"
    label = "Mahsulot"

    detections: list[dict[str, Any]] = []
    if (settings.fashion_detect_backend or "yolos").lower() == "yolos":
        from app.infrastructure.ai_clients.yolos_fashion_detect import detect_fashion_garments

        yolos_slots = await detect_fashion_garments(raw)
        detections = _collapse_strip_detections(
            [d for d in yolos_slots if not is_invalid_outfit_bbox(d.get("bbox"))]
        )
        if _should_collapse_product_fragments(pil, detections):
            detections = []

    if detections:
        for item in detections:
            item["label_uz"] = "visual"
            item["color"] = item.get("color") or color
        return detections[:3]

    try:
        vision = await GeminiClient().extract_attributes(raw)
        cat_hint = str(vision.get("category") or "")
        category = normalize_visual_category(label_uz=cat_hint, category=cat_hint)
        label = _category_label_uz(category)
        vision_color = normalize_color_uz(str(vision.get("color") or ""))
        if vision_color:
            color = vision_color
    except Exception as exc:
        logger.warning("product_photo_vision_failed", error=str(exc))

    search_query = f"{color or ''} {label}".strip() or label
    return [
        {
            "id": "product",
            "label_uz": "visual",
            "category": category,
            "color": color or None,
            "material": fallback.get("material"),
            "search_query": search_query,
            "bbox": bbox,
            "product_panel": True,
        }
    ]


async def detect_outfit_items(raw: bytes) -> list[dict[str, Any]]:
    """Taobao-style detection for outfit photos and single product shots."""
    pil = Image.open(io.BytesIO(raw)).convert("RGB")

    if _looks_like_product_photo(pil):
        product_items = await _detect_product_photo_items(raw, pil)
        if product_items:
            return product_items

    panels = find_vertical_panels(pil)
    if len(panels) >= 2:
        collage_items = await _detect_collage_items(raw, pil, panels)
        if collage_items:
            return collage_items

    vision_raw = _downscale_image_bytes(raw, max_edge=768)
    groq = GroqClient()
    from app.core.config import get_settings

    settings = get_settings()

    if _looks_like_outfit_photo(pil) or has_wearable_person(pil):
        fallback = _local_fallback_from_bytes(raw, pil)
        color_raw = str(fallback.get("color") or "")
        color = (
            normalize_color_uz(color_raw.replace("#", ""))
            if color_raw.startswith("#")
            else normalize_color_uz(color_raw)
        )

        body_slots = build_body_part_detections(
            pil,
            color=color or None,
            material=fallback.get("material"),
        )
        detections: list[dict[str, Any]] = []
        if (settings.fashion_detect_backend or "yolos").lower() == "yolos":
            from app.infrastructure.ai_clients.yolos_fashion_detect import detect_fashion_garments

            yolos_slots = await detect_fashion_garments(raw)
            detections = merge_fashion_slots(yolos_slots, body_slots)
        else:
            detections = body_slots

        detections = filter_sky_detections(pil, detections)

        if detections:
            settings_prompt = (
                "Bu rasm odam kiyimi. Har bir kiyim uchun rang va category aniqlang. "
                "Faqat JSON: {\"items\":["
                "{\"category\":\"top\",\"color\":\"qora\",\"search_query\":\"qora futbolka\"},"
                "{\"category\":\"pants\",\"color\":\"kulrang\",\"search_query\":\"kulrang shim\"},"
                "{\"category\":\"shoes\",\"color\":\"oq\",\"search_query\":\"oq krossovka\"}"
                "]}"
            )
            groq_meta = await _groq_outfit_detections(pil, vision_raw, groq, settings_prompt)
            merged = merge_groq_metadata(detections, groq_meta)
            for item in merged:
                item["label_uz"] = "visual"
            return merged

    settings_prompt = (
        "Sen O'zbekiston onlayn bozori (Bozorliii) uchun vizual qidiruv AI sanaysan. "
        "Avval rasm turini aniqlang: (A) odam kiyimi/komplekt yoki (B) bitta mahsulot (tovar) foto. "
        "B bo'lsa — FAQAT 1 ta item qaytaring; bbox butun mahsulotni qamrab olsin (taxminan x:0.05,y:0.05,w:0.9,h:0.9). "
        "A bo'lsa — har bir kiyim parchasini alohida ajrat (Taobao): kurtka, sviter/ko'ylak, shim, oyoq kiyim, sumka. "
        "bbox FAQAT kiyim matosini qamrasin — tor va aniq; fon, daraxt, osmon, yuz, quti, qo'l KIRMASIN. "
        "Odam markazida qoling — chetdagi fonni tanlamang. "
        "Yuz, fon, quti, qo'l — item emas. "
        "label_uz — qisqa o'zbekcha (Kurtka, Tufli, Krossovka, Shim). "
        "category — INGLIZCHA slug: shoes | jacket | pants | shirt | top | dress | belt | bag. "
        "Tufli/krossovka/bot → shoes. Sviter/futbolka → top yoki shirt. "
        "color — MAJBURIY o'zbekcha: sariq, qora, oq, ko'k, qizil, yashil, bej, jigarrang, kulrang. "
        "search_query — rang + buyum (masalan: 'pushti ayol tufli', 'qora sport krossovka'). "
        "bbox: 0-1 normal (x,y yuqori chap, w,h). Maksimum 6 ta item. "
        'Faqat JSON: {"items":[{"id":"1","label_uz":"Tufli","category":"shoes","color":"pushti",'
        '"material":"mato","search_query":"pushti ayol tufli","bbox":{"x":0.1,"y":0.15,"w":0.8,"h":0.7}}]}'
    )
    normalized = await _groq_outfit_detections(pil, vision_raw, groq, settings_prompt)
    if normalized:
        normalized = _resolve_bbox_overlaps(normalized)

    if normalized and not (_looks_like_product_photo(pil) and _is_default_outfit_heuristic(normalized)):
        return normalized

    if settings.groq_api_key:
        product_items = await _detect_product_only_items(vision_raw, groq)
        if product_items:
            return product_items

    if _looks_like_product_photo(pil):
        single = await _heuristic_single_product_detection(raw, pil)
        if single:
            return single

    if normalized:
        return normalized

    if has_wearable_person(pil):
        fallback = _local_fallback_from_bytes(raw, pil)
        color_raw = str(fallback.get("color") or "")
        color = (
            normalize_color_uz(color_raw.replace("#", ""))
            if color_raw.startswith("#")
            else normalize_color_uz(color_raw)
        )
        slots = filter_sky_detections(
            pil,
            build_body_part_detections(pil, color=color or None, material=fallback.get("material")),
        )
        if slots:
            for item in slots:
                item["label_uz"] = "visual"
            return slots

    return _heuristic_zone_detections(raw)


async def _detect_product_only_items(vision_raw: bytes, groq: GroqClient) -> list[dict[str, Any]]:
    prompt = (
        "Bu rasm bitta mahsulot (tovar) fotosurati. Odamlar yoki to'liq kiyim komplekti emas. "
        "Faqat 1 ta asosiy mahsulotni aniqlang (oyoq kiyim, kurtka, sumka va h.k.). "
        "bbox butun mahsulotni qamrab olsin. "
        'JSON: {"items":[{"id":"1","label_uz":"Tufli","category":"shoes","color":"pushti",'
        '"search_query":"pushti ayol tufli","bbox":{"x":0.05,"y":0.05,"w":0.9,"h":0.9}}]}'
    )
    try:
        payload = await groq.chat_json(
            system_prompt="Product photo detector. JSON only.",
            user_prompt=prompt,
            vision=True,
            image_bytes=vision_raw,
            image_mime=_guess_mime(vision_raw),
        )
        items = payload.get("items") if isinstance(payload, dict) else None
        if isinstance(items, list) and items:
            normalized = [_normalize_detection(item, index) for index, item in enumerate(items[:1])]
            return _resolve_bbox_overlaps(normalized)
    except Exception as exc:
        logger.warning("product_detect_groq_failed", error=str(exc))
    return []


async def _heuristic_single_product_detection(raw: bytes, pil: Image.Image) -> list[dict[str, Any]]:
    fallback = _local_fallback_from_bytes(raw, pil)
    color_raw = str(fallback.get("color") or "")
    color = normalize_color_uz(color_raw.replace("#", "")) if color_raw.startswith("#") else normalize_color_uz(color_raw)
    category = "shoes"
    label = "Mahsulot"
    try:
        vision = await GeminiClient().extract_attributes(raw)
        cat_hint = str(vision.get("category") or "")
        category = normalize_visual_category(label_uz=cat_hint, category=cat_hint)
        label = _category_label_uz(category)
        vision_color = normalize_color_uz(str(vision.get("color") or ""))
        if vision_color:
            color = vision_color
    except Exception as exc:
        logger.warning("single_product_vision_failed", error=str(exc))

    search_query = f"{color or ''} {label}".strip() or label
    return [
        {
            "id": "1",
            "label_uz": label,
            "category": category,
            "color": color,
            "material": fallback.get("material"),
            "search_query": search_query,
            "bbox": _tight_product_bbox(pil),
        }
    ]


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
    """Fallback: body zones anchored on the person column."""
    pil = Image.open(io.BytesIO(raw)).convert("RGB")
    fallback = _local_fallback_from_bytes(raw, pil)
    color = fallback.get("color") or ""
    color_s = color.replace("#", "") if str(color).startswith("#") else str(color)
    from app.application.visual_search.bbox_refine import estimate_subject_column

    cx, sw = estimate_subject_column(pil)
    items = person_heuristic_zones(
        center_x=cx,
        subject_w=sw,
        color=color_s or None,
        material=fallback.get("material"),
        pil=pil,
    )
    return filter_sky_detections(pil, _resolve_bbox_overlaps(items))


def _attributes_to_query(attrs: dict[str, Any]) -> str:
    parts = [str(attrs.get("category") or ""), str(attrs.get("color") or ""), str(attrs.get("material") or "")]
    parts.extend(str(t) for t in (attrs.get("style_tags") or []) if t)
    return " ".join(p for p in parts if p).strip() or "kiyim"


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _bbox_area(bbox: dict[str, float]) -> float:
    return float(bbox["w"]) * float(bbox["h"])


def _filter_visual_detections(detections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for det in detections:
        if str(det.get("id")) == "whole":
            continue
        if is_invalid_outfit_bbox(det.get("bbox")):
            continue
        out.append(det)
    return out[:6]


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

            boxes[smaller] = clamp_bbox_in_frame(
                {
                    "x": _clamp01(s["x"]),
                    "y": _clamp01(s["y"]),
                    "w": _clamp01(s["w"]),
                    "h": _clamp01(s["h"]),
                }
            )

    resolved: list[dict[str, Any]] = []
    for item, bbox in zip(items, boxes):
        merged = dict(item)
        merged["bbox"] = clamp_bbox_in_frame(bbox)
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


def refine_crop_data_url(pil: Image.Image) -> str:
    """High-res crop for refine API — Taobao sends full region, not tiny thumb."""
    thumb = prepare_taobao_crop(pil)
    thumb.thumbnail((512, 512))
    buf = io.BytesIO()
    thumb.save(buf, format="JPEG", quality=88)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def _maybe_add_whole_image_slot(detections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Taobao: 'search entire image' alongside region chips."""
    if not detections or any(str(d.get("id")) == "whole" for d in detections):
        return detections
    if len(detections) == 1:
        bbox = detections[0].get("bbox") or {}
        if _bbox_area(bbox) >= 0.72:
            return detections
    primary = detections[0]
    color = primary.get("color")
    label = str(primary.get("label_uz") or "Mahsulot")
    category = str(primary.get("category") or "top")
    query = str(primary.get("search_query") or label).strip()
    whole = {
        "id": "whole",
        "label_uz": "Butun rasm",
        "category": category,
        "color": color,
        "material": primary.get("material"),
        "search_query": query or "rasm bo'yicha mahsulot",
        "bbox": {"x": 0.02, "y": 0.02, "w": 0.96, "h": 0.96},
        "loose_slot": True,
    }
    return [whole, *detections]


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
            elif int(row.get("visual_match_pct") or 0) >= 38 and row.get("visual_match"):
                if not any(bad in hay for bad in hard_block):
                    matched.append(row)
        elif not strict:
            matched.append(row)

    if not matched and rows and strict:
        # Vizual o'xshashlik yuqori — slot kalit so'zisiz ham (Taobao crop match)
        for row in rows:
            pct = int(row.get("visual_match_pct") or 0)
            if row.get("visual_match") and pct >= 38:
                hay = _product_blob(row)
                if not any(bad in hay for bad in hard_block + exclude):
                    matched.append(row)

    if not matched and rows and not strict:
        for row in rows:
            hay = _product_blob(row)
            if any(bad in hay for bad in hard_block + exclude):
                continue
            matched.append(row)
        matched = matched[: max(8, len(rows))]

    return matched


def _rank_visual_products(rows: list[dict[str, Any]], filters: dict[str, Any]) -> list[dict[str, Any]]:
    color_terms = [t.lower() for t in (filters.get("color_terms") or color_search_terms(filters.get("color")))]
    exclude = [str(p).lower() for p in (filters.get("exclude_name_patterns") or []) if len(str(p)) >= 3]

    slot_keywords = [str(k).lower() for k in (filters.get("slot_category_keywords") or []) if str(k).strip()]

    def score(row: dict[str, Any]) -> int:
        hay = _product_blob(row)
        pts = int(row.get("visual_match_pct") or 0)
        if pts >= 70:
            pts += 15
        elif pts >= 55:
            pts += 6
        for term in color_terms:
            if term in hay:
                pts += 14
        for kw in slot_keywords:
            if kw in hay:
                pts += 18
        for bad in exclude:
            if bad in hay:
                pts -= 28
        if row.get("is_fallback"):
            pts -= 8
        if row.get("is_featured"):
            pts += 4
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


def _rank_pure_visual(rows: list[dict[str, Any]], *, strict: bool = True) -> list[dict[str, Any]]:
    """Image-to-image only — sort by visual_match_pct."""
    from app.application.visual_search.visual_search_engine import (
        MIN_OUTFIT_MATCH_PCT,
        MIN_PRODUCT_MATCH_PCT,
        _is_trusted_match,
    )

    min_pct = MIN_OUTFIT_MATCH_PCT if strict else MIN_PRODUCT_MATCH_PCT
    trusted = [r for r in rows if _is_trusted_match(r)]
    rest = [r for r in rows if r not in trusted]
    strong = [r for r in rest if int(r.get("visual_match_pct") or 0) >= min_pct]
    pool = trusted + (strong if strong else (rest[:6] if not strict else trusted))
    return sorted(
        pool,
        key=lambda row: (
            1 if row.get("visual_match") else 0,
            int(row.get("visual_match_pct") or 0),
        ),
        reverse=True,
    )


async def _resolve_pure_visual_matches(
    product_repo: ProductRepo,
    marketplace_repo: MarketplaceRepository,
    *,
    crop_bytes: bytes,
    limit: int,
    min_price: float | None = None,
    max_price: float | None = None,
    strict: bool = True,
    fast: bool = True,
) -> tuple[list[dict[str, Any]], bool]:
    """Taobao core: crop → visual ANN → rank by similarity. No text/slot/keyword."""
    if not crop_bytes:
        return [], True
    try:
        rows = await taobao_search_by_crop(
            product_repo,
            marketplace_repo,
            crop_bytes,
            limit=limit,
            min_price=min_price,
            max_price=max_price,
            search_hint=PURE_VISUAL_SEARCH_HINT,
            fast=fast,
            strict=strict,
        )
        return _rank_pure_visual(rows, strict=strict)[:limit], True
    except Exception as exc:
        logger.warning("pure_visual_search_failed", error=str(exc))
        return [], True


async def _resolve_visual_matches_fast(
    product_repo: ProductRepo,
    marketplace_repo: MarketplaceRepository,
    *,
    filters: dict[str, Any],
    vision: dict[str, Any],
    det: dict[str, Any],
    limit: int,
    crop_bytes: bytes | None = None,
    fast: bool = True,
) -> tuple[list[dict[str, Any]], bool]:
    """Fast path: parallel crop visual + keyword slot — no OpenAI embed / hybrid."""
    if filters.get("image_only_search") and crop_bytes:
        strict = False
        return await _resolve_pure_visual_matches(
            product_repo,
            marketplace_repo,
            crop_bytes=crop_bytes,
            limit=limit,
            min_price=float(filters["min_price"]) if filters.get("min_price") is not None else None,
            max_price=float(filters["max_price"]) if filters.get("max_price") is not None else None,
            strict=strict,
            fast=fast,
        )

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
                fast=fast,
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

    if visual_filtered and keyword_filtered:
        fused = _fuse_taobao_rank(visual_filtered, keyword_filtered, limit=limit)
        return fused, True
    if visual_filtered:
        return visual_filtered[:limit], True
    if keyword_filtered:
        return keyword_filtered[:limit], False

    # Matn vektor zaxirasi — katalogda visual_embedding bo'lmasa ham topadi
    try:
        from app.infrastructure.ai_clients.embedding import EmbeddingClient

        embedder = EmbeddingClient()
        vector = await embedder.embed(hint)
        loose_filters = {**strict_filters, "strict_slot": False}
        text_matches = await product_repo.hybrid_search(
            vector,
            loose_filters,
            limit=limit,
            min_price=float(min_p) if min_p is not None else None,
            max_price=float(max_p) if max_p is not None else None,
        )
        text_rows = await _products_from_matches(marketplace_repo, text_matches)
        text_ranked = _prefer_color_aligned(
            _filter_slot_products(_rank_visual_products(text_rows, loose_filters), loose_filters),
            loose_filters,
        )
        if text_ranked:
            for row in text_ranked:
                row["match_mode"] = row.get("match_mode") or "text"
            return text_ranked[:limit], False
    except Exception as exc:
        logger.warning("visual_text_fallback_failed", error=str(exc))

    # Vizual qatorlar filtrdan o'tmagan bo'lsa ham — eng yaqin rasmlar
    if visual_rows:
        loose = [r for r in _rank_visual_products(visual_rows, strict_filters) if r]
        if loose:
            return loose[:limit], True

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
            fast=fast,
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


def _fast_assistant_text(
    detected_payloads: list[dict[str, Any]],
    *,
    flat_items: list[dict[str, Any]] | None = None,
) -> str:
    """Vizual moslik xulosasi — mahsulot nomlari ko'rsatilmaydi (faqat rasm→rasm)."""
    if not detected_payloads:
        if flat_items:
            top_pct = int(flat_items[0].get("visual_match_pct") or 0)
            return (
                f"{len(flat_items)} ta vizual mos rasm"
                + (f" (eng yuqori {top_pct}%)" if top_pct else "")
            )
        return "Bazada vizual mos mahsulot topilmadi. Boshqa rasm sinab ko'ring."

    parts: list[str] = []
    for block in detected_payloads:
        prods = block.get("products") or []
        if not prods:
            continue
        top_pct = int(prods[0].get("visual_match_pct") or 0)
        parts.append(f"{len(prods)} ta vizual moslik" + (f" (≤{top_pct}%)" if top_pct else ""))

    if parts:
        return "Rasm bo'yicha topildi — " + " · ".join(parts)
    return "Nuqta yoki ramka tanlang — faqat shu qism rasmi bo'yicha qidiriladi."


def _synthetic_detection_payload(
    *,
    det_id: str,
    pil: Image.Image,
    products: list[dict[str, Any]],
    bbox: dict[str, float] | None = None,
) -> dict[str, Any]:
    box = bbox or {"x": 0.02, "y": 0.02, "w": 0.96, "h": 0.96}
    raw_crop = crop_bbox(pil, box, padding=0.02)
    clip_crop = prepare_taobao_crop(raw_crop)
    return {
        "id": det_id,
        "label_uz": "visual",
        "category": None,
        "color": None,
        "material": None,
        "search_query": "",
        "bbox": box,
        "thumbnail_url": thumbnail_data_url(raw_crop),
        "refine_crop_url": refine_crop_data_url(clip_crop),
        "vision": None,
        "products": products,
        "total": len(products),
        "is_fallback": False,
    }


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
        max_items = min(max_items, 5)
        limit_per_item = min(limit_per_item, 12)
    else:
        max_items = min(max_items, 6)
        limit_per_item = min(limit_per_item, 16)

    pil = Image.open(io.BytesIO(raw)).convert("RGB")
    collage_panels = find_vertical_panels(pil)
    is_collage = len(collage_panels) >= 2 and not _looks_like_product_photo(pil)
    product_repo = ProductRepo(session)
    marketplace_repo = MarketplaceRepository(session)
    if not is_collage and (_looks_like_product_photo(pil) or not has_wearable_person(pil)):
        products = await taobao_search_by_crop(
            product_repo,
            marketplace_repo,
            raw,
            limit=limit_per_item,
            search_hint=PURE_VISUAL_SEARCH_HINT,
            fast=fast,
            strict=False,
        )
        chip = _synthetic_detection_payload(det_id="product", pil=pil, products=products)
        assistant = _fast_assistant_text([chip], flat_items=products)
        return {
            "items": products,
            "total": len(products),
            "page": 1,
            "vision": _local_fallback_from_bytes(raw, pil),
            "query_label": "Rasm bo'yicha qidiruv",
            "detected_items": [chip],
            "primary_detection_id": "product",
            "mode": "product_photo_fast" if fast else "product_photo",
            "is_fallback": False,
            "jonli_katalog_natijasi": build_jonli_katalog_natijasi(exact_items=products, vector_neighbors=products),
            "assistant_text": assistant,
            "selected_product_ids": [str(p["id"]) for p in products[:8] if p.get("id")],
            "look_groups": [],
            "look_intent": parse_look_intent(intent_text or ""),
        }

    detections = _maybe_add_whole_image_slot((await detect_outfit_items(raw))[:max_items])
    outfit_slots = ("top", "jacket", "pants", "shoes", "product")
    detections = [
        d
        for d in detections
        if str(d.get("id") or d.get("slot") or "").startswith("product")
        or str(d.get("id") or d.get("slot") or "") in outfit_slots
    ][:max_items]
    if not detections:
        if has_wearable_person(pil) and not _looks_like_product_photo(pil):
            detections = _heuristic_zone_detections(raw)[:3]
        else:
            detections = await _detect_product_photo_items(raw, pil)
    elif _looks_like_default_body_slots(detections) and (
        _looks_like_product_photo(pil) or not has_wearable_person(pil)
    ):
        detections = await _detect_product_photo_items(raw, pil)

    if not is_collage and (
        _looks_like_product_photo(pil)
        or _should_collapse_product_fragments(pil, detections)
        or (_looks_like_default_body_slots(detections) and not has_wearable_person(pil))
    ):
        products = await taobao_search_by_crop(
            product_repo,
            marketplace_repo,
            raw,
            limit=limit_per_item,
            search_hint=PURE_VISUAL_SEARCH_HINT,
            fast=fast,
            strict=False,
        )
        chip = _synthetic_detection_payload(det_id="product", pil=pil, products=products)
        assistant = _fast_assistant_text([chip], flat_items=products)
        return {
            "items": products,
            "total": len(products),
            "page": 1,
            "vision": _local_fallback_from_bytes(raw, pil),
            "query_label": "Rasm bo'yicha qidiruv",
            "detected_items": [chip],
            "primary_detection_id": "product",
            "mode": "product_photo_fast" if fast else "product_photo",
            "is_fallback": False,
            "jonli_katalog_natijasi": build_jonli_katalog_natijasi(exact_items=products, vector_neighbors=products),
            "assistant_text": assistant,
            "selected_product_ids": [str(p["id"]) for p in products[:8] if p.get("id")],
            "look_groups": [],
            "look_intent": parse_look_intent(intent_text or ""),
        }

    embedder = EmbeddingClient()

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
        raw_crop = crop_bbox(pil, det["bbox"], padding=0.02)
        clip_crop = prepare_taobao_crop(raw_crop)
        det = _apply_crop_color_to_detection(det, raw_crop)
        crop_bytes = io.BytesIO()
        quality = 86 if fast else 90
        clip_crop.save(crop_bytes, format="JPEG", quality=quality)
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
        if filters.get("image_only_search"):
            products = _rank_pure_visual(products, strict=str(det.get("id")) != "product")
        else:
            products = _prefer_color_aligned(products, filters)
            if not products and crop_raw:
                try:
                    global_hits = await taobao_search_by_crop(
                        item_product_repo,
                        item_marketplace_repo,
                        crop_raw,
                        limit=limit_per_item,
                        search_hint=PURE_VISUAL_SEARCH_HINT,
                        fast=fast,
                    )
                    products = _rank_pure_visual(global_hits, strict=False)
                except Exception as exc:
                    logger.warning("slot_global_visual_retry_failed", error=str(exc))

        return {
            "det": det,
            "crop": clip_crop,
            "search_text": search_text,
            "vision": vision,
            "products": products,
            "used_vector": used_vector,
        }

    if fast and len(detections) > 1:
        processed: list[Any] = []
        for det in detections:
            try:
                processed.append(await _process_detection(det))
            except BaseException as exc:
                processed.append(exc)
    else:
        processed = await asyncio.gather(*[_process_detection(det) for det in detections], return_exceptions=True)

    for result in processed:
        if isinstance(result, BaseException):
            logger.warning("outfit_item_process_failed", error=repr(result))
            continue
        det = result["det"]
        clip_crop = result["crop"]
        display_crop = crop_bbox(pil, det["bbox"], padding=0.02)
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
                "label_uz": "visual",
                "category": det.get("category"),
                "color": det.get("color"),
                "material": det.get("material"),
                "search_query": search_text,
                "bbox": det["bbox"],
                "thumbnail_url": thumbnail_data_url(display_crop),
                "refine_crop_url": refine_crop_data_url(clip_crop),
                "vision": vision if not fast else None,
                "products": products,
                "total": len(products),
                "is_fallback": used_vector,
            }
        )

    if not flat_items:
        global_rows = await taobao_search_by_crop(
            product_repo,
            marketplace_repo,
            raw,
            limit=limit_per_item * max(2, max_items),
            search_hint=intent_text or "fashion outfit clothing photo",
            fast=fast,
            strict=True,
        )
        for row in global_rows:
            pid = str(row["id"])
            if pid not in seen:
                seen.add(pid)
                flat_items.append(row)

    if flat_items and not detected_payloads:
        detected_payloads.append(_synthetic_detection_payload(det_id="full", pil=pil, products=flat_items[:limit_per_item]))

    primary_vision = detected_payloads[0]["vision"] if detected_payloads else _local_fallback_from_bytes(raw)
    query_label = (intent_text or "").strip() or "Rasm bo'yicha qidiruv"
    exact_only = [p for p in flat_items if not p.get("is_fallback")]
    jonli = build_jonli_katalog_natijasi(exact_items=exact_only, vector_neighbors=flat_items)
    look_intent = parse_look_intent(intent_text or query_label)
    _, budget_max = parse_budget_from_text(intent_text or "")

    if fast:
        assistant_text = _fast_assistant_text(detected_payloads, flat_items=flat_items)
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

    def _block_best_pct(block: dict[str, Any]) -> int:
        products = block.get("products") or []
        if not products:
            return 0
        return max(int(p.get("visual_match_pct") or 0) for p in products)

    detected_payloads = [b for b in detected_payloads if str(b.get("id")) != "whole"]
    def _block_sort_key(block: dict[str, Any]) -> tuple[int, int, int, float]:
        bid = str(block.get("id") or "")
        id_rank = 4 if bid == "top" else 3 if bid == "pants" else 2 if bid == "shoes" else 1
        bbox = block.get("bbox") or {}
        y = float(bbox.get("y") or 0.5)
        sky_penalty = -30 if y < 0.18 else (-8 if y < 0.22 else 0)
        body_rank = 3 if 0.18 <= y < 0.52 else 0
        return (_block_best_pct(block), id_rank + body_rank + sky_penalty, len(block.get("products") or []), -y)

    detected_payloads = sorted(detected_payloads, key=_block_sort_key, reverse=True)
    primary_detection_id = str(detected_payloads[0]["id"]) if detected_payloads else None

    return {
        "items": display_items[: limit_per_item * max_items],
        "total": len(display_items),
        "page": 1,
        "vision": primary_vision if not fast else {},
        "query_label": query_label,
        "detected_items": detected_payloads,
        "primary_detection_id": primary_detection_id,
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
    """Chip qayta qidiruv — faqat crop rasm vizual mosligi (nom/kategoriya ishlatilmaydi)."""
    _ = (search_query, color, material, intent_text, label_uz)
    category_slug = normalize_visual_category(label_uz=label_uz, category=category or "")
    product_repo = ProductRepo(session)
    marketplace_repo = MarketplaceRepository(session)

    crop_bytes = _decode_crop_base64(crop_base64)
    if not crop_bytes:
        return {
            "products": [],
            "total": 0,
            "category": category_slug,
            "selected_category": category_slug,
            "label_uz": label_uz,
            "is_fallback": False,
            "match_mode": "visual",
        }

    products, _ = await _resolve_pure_visual_matches(
        product_repo,
        marketplace_repo,
        crop_bytes=crop_bytes,
        limit=limit,
        min_price=float(min_price) if min_price is not None else None,
        max_price=float(max_price) if max_price is not None else None,
    )

    return {
        "products": products,
        "total": len(products),
        "category": category_slug,
        "selected_category": category_slug,
        "label_uz": label_uz,
        "is_fallback": False,
        "match_mode": "visual",
    }
