"""
Fashion garment detection — yainage90/fashion-object-detection-yolos-tiny (YOLOS + Fashionpedia).

GitHub ref: https://github.com/yainage90/fashion-visual-search
Model: top | outer | bottom | shoes | dress | bag | hat
"""

from __future__ import annotations

import asyncio
import io
import threading
from typing import Any

from loguru import logger
from PIL import Image

SCORE_THRESHOLD = 0.22

_LABEL_TO_CATEGORY: dict[str, tuple[str, str]] = {
    "top, t-shirt, sweatshirt": ("top", "Futbolka"),
    "shirt, blouse": ("top", "Futbolka"),
    "sweater": ("top", "Sviter"),
    "cardigan": ("jacket", "Kardigan"),
    "jacket": ("jacket", "Kurtka"),
    "vest": ("top", "Jilet"),
    "pants": ("pants", "Shim"),
    "shorts": ("pants", "Shortik"),
    "skirt": ("dress", "Yubka"),
    "coat": ("jacket", "Palto"),
    "dress": ("dress", "Libos"),
    "jumpsuit": ("dress", "Kombinezon"),
    "shoe": ("shoes", "Oyoq kiyim"),
    "bag, wallet": ("bag", "Sumka"),
}

_SKIP_PARTS = (
    "sleeve",
    "collar",
    "pocket",
    "neckline",
    "zipper",
    "hood",
    "epaulette",
    "lapel",
    "glasses",
    "hat",
    "headband",
    "glove",
    "watch",
    "belt",
    "sock",
    "tights",
    "scarf",
    "umbrella",
    "bead",
    "bow",
    "flower",
    "fringe",
    "ribbon",
    "rivet",
    "ruffle",
    "sequin",
    "tassel",
    "buckle",
    "applique",
)

_model = None
_processor = None
_lock = threading.Lock()


def _model_id() -> str:
    from app.core.config import get_settings

    return get_settings().yolos_fashion_model or "valentinafevu/yolos-fashionpedia"


def _get_yolos():
    global _model, _processor
    with _lock:
        if _model is None:
            import torch
            from transformers import YolosForObjectDetection

            try:
                from transformers import YolosImageProcessorPil as YolosProcessor
            except ImportError:
                from transformers import YolosImageProcessor as YolosProcessor

            model_id = _model_id()
            logger.info("yolos_fashion_loading", model=model_id)
            _processor = YolosProcessor.from_pretrained(model_id)
            _model = YolosForObjectDetection.from_pretrained(model_id)
            _model.eval()
            logger.info("yolos_fashion_ready", model=model_id)
        return _model, _processor


def _bbox_iou(a: dict[str, float], b: dict[str, float]) -> float:
    x0 = max(a["x"], b["x"])
    y0 = max(a["y"], b["y"])
    x1 = min(a["x"] + a["w"], b["x"] + b["w"])
    y1 = min(a["y"] + a["h"], b["y"] + b["h"])
    if x1 <= x0 or y1 <= y0:
        return 0.0
    inter = (x1 - x0) * (y1 - y0)
    union = a["w"] * a["h"] + b["w"] * b["h"] - inter
    return inter / union if union > 0 else 0.0


def _pick_best_per_label(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_label: dict[str, dict[str, Any]] = {}
    for cand in sorted(candidates, key=lambda c: float(c["score"]), reverse=True):
        slot = str(cand.get("slot") or cand.get("id") or "")
        if slot in by_label:
            continue
        dup = False
        for kept in by_label.values():
            if _bbox_iou(cand["bbox"], kept["bbox"]) > 0.50:
                dup = True
                break
        if dup:
            continue
        by_label[slot] = cand
    order = ("top", "jacket", "pants", "shoes")
    out: list[dict[str, Any]] = []
    seen_slot: set[str] = set()
    for key in order:
        for cand in by_label.values():
            if cand.get("slot") == key and key not in seen_slot:
                out.append(cand)
                seen_slot.add(key)
                break
    if not out:
        out = list(by_label.values())
    return out[:4]


def _reject_sky_crop(pil: Image.Image, bbox: dict[str, float], *, category: str) -> bool:
    from app.application.visual_search.bbox_refine import _sky_ratio

    fw, fh = pil.size
    crop = pil.crop(
        (
            int(bbox["x"] * fw),
            int(bbox["y"] * fh),
            int((bbox["x"] + bbox["w"]) * fw),
            int((bbox["y"] + bbox["h"]) * fh),
        )
    )
    sky_limit = 0.34 if category in ("top", "jacket") else 0.42
    if _sky_ratio(crop) > sky_limit:
        return True
    y = float(bbox.get("y", 0))
    h = float(bbox.get("h", 0))
    if category in ("top", "jacket", "shirt") and y < 0.14 and _sky_ratio(crop) > 0.18:
        return True
    if category in ("top", "jacket", "shirt") and y < 0.20 and h < 0.18 and _sky_ratio(crop) > 0.24:
        return True
    return False


def _detect_sync(image_bytes: bytes) -> list[dict[str, Any]]:
    import torch

    pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    w, h = pil.size
    if w < 32 or h < 32:
        return []

    model, processor = _get_yolos()
    inputs = processor(images=pil, return_tensors="pt")
    with torch.no_grad():
        outputs = model(**inputs)

    target_sizes = torch.tensor([[h, w]])
    results = processor.post_process_object_detection(
        outputs,
        threshold=SCORE_THRESHOLD,
        target_sizes=target_sizes,
    )[0]

    candidates: list[dict[str, Any]] = []
    for score, label_id, box in zip(
        results["scores"],
        results["labels"],
        results["boxes"],
        strict=False,
    ):
        raw_label = str(model.config.id2label[int(label_id)]).strip().lower()
        if any(part in raw_label for part in _SKIP_PARTS):
            continue
        if raw_label not in _LABEL_TO_CATEGORY:
            continue

        x0, y0, x1, y1 = (float(v) for v in box.tolist())
        bw = max(0.06, (x1 - x0) / w)
        bh = max(0.06, (y1 - y0) / h)
        bx = max(0.0, min(1.0 - bw, x0 / w))
        by = max(0.0, min(1.0 - bh, y0 / h))

        if bw * bh < 0.010 or bw * bh > 0.58:
            continue
        if bw > 0.82 or bh > 0.72:
            continue

        category, label_uz = _LABEL_TO_CATEGORY[raw_label]
        slot_id = category if category in ("top", "pants", "shoes", "jacket", "dress", "bag") else "top"
        bbox = {"x": bx, "y": by, "w": bw, "h": bh}
        if _reject_sky_crop(pil, bbox, category=category):
            continue
        candidates.append(
            {
                "id": slot_id,
                "label_uz": label_uz,
                "category": category,
                "color": None,
                "material": None,
                "search_query": label_uz.lower(),
                "bbox": bbox,
                "score": float(score),
                "label_name": raw_label,
                "slot": slot_id,
                "yolos": True,
                "body_slot": True,
            }
        )

    return _pick_best_per_label(candidates)


async def detect_fashion_garments(image_bytes: bytes) -> list[dict[str, Any]]:
    try:
        return await asyncio.to_thread(_detect_sync, image_bytes)
    except Exception as exc:
        logger.warning("yolos_fashion_detect_failed", error=str(exc)[:400])
        return []


async def warmup_yolos_fashion() -> None:
    try:
        import torch

        buf = io.BytesIO()
        Image.new("RGB", (320, 480), (40, 40, 40)).save(buf, format="JPEG")
        await detect_fashion_garments(buf.getvalue())
        logger.info("yolos_fashion_warmup_done")
    except Exception as exc:
        logger.warning("yolos_fashion_warmup_failed", error=str(exc)[:200])
