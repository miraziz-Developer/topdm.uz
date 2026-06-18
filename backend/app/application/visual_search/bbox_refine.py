"""Taobao-style outfit bbox: person silhouette + body-part clothing crops."""

from __future__ import annotations

from typing import Any

from PIL import Image


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _bbox_area(bbox: dict[str, float]) -> float:
    return float(bbox["w"]) * float(bbox["h"])


def _bbox_center_x(bbox: dict[str, float]) -> float:
    return float(bbox["x"]) + float(bbox["w"]) / 2


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


def is_outfit_portrait_photo(pil: Image.Image) -> bool:
    w, h = pil.size
    if w <= 0 or h <= 0:
        return False
    return h / w >= 1.12


def has_wearable_person(pil: Image.Image) -> bool:
    """Tik turgan odam silueti — portret/landshaft farqi qilmaydi."""
    w, h = pil.size
    if w <= 0 or h <= 0:
        return False
    person = estimate_person_silhouette_bbox(pil)
    if float(person["h"]) < 0.40:
        return False
    aspect = float(person["w"]) / max(float(person["h"]), 0.01)
    if aspect > 0.78:
        return False
    cx = person["x"] + person["w"] / 2
    if cx < 0.12 or cx > 0.88:
        return False
    return True


def is_invalid_outfit_bbox(bbox: dict[str, Any] | None) -> bool:
    if not bbox:
        return True
    x = float(bbox.get("x", 0))
    y = float(bbox.get("y", 0))
    w = float(bbox.get("w", 0))
    h = float(bbox.get("h", 0))
    if w < 0.10 or h < 0.10:
        return True
    if _bbox_area(bbox) < 0.035:
        return True
    if _bbox_area(bbox) > 0.82:
        return True
    aspect = w / max(h, 1e-6)
    if aspect < 0.20 or aspect > 4.5:
        return True
    cx = _bbox_center_x(bbox)
    if cx < 0.20 or cx > 0.80:
        return True
    if x < 0.04 and w < 0.32:
        return True
    if x + w > 0.96 and w < 0.32:
        return True
    if y < 0.10 and h <= 0.28 and w >= 0.65:
        return True
    return False


def _rgb_dist(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def _skin_ratio_in_bbox(pil: Image.Image, bbox: dict[str, float]) -> float:
    """Yuz/qo'l terisi — odam fotosida bor, tovar kartochkasida yo'q."""
    fw, fh = pil.size
    x0 = int(_clamp01(float(bbox.get("x", 0))) * fw)
    y0 = int(_clamp01(float(bbox.get("y", 0))) * fh)
    x1 = int(_clamp01(float(bbox.get("x", 0)) + float(bbox.get("w", 0))) * fw)
    y1 = int(_clamp01(float(bbox.get("y", 0)) + float(bbox.get("h", 0))) * fh)
    if x1 - x0 < 8 or y1 - y0 < 8:
        return 0.0
    region = pil.crop((x0, y0, x1, y1)).convert("RGB")
    thumb = region.copy()
    thumb.thumbnail((72, 96), Image.Resampling.BILINEAR)
    pixels = list(thumb.getdata())
    if not pixels:
        return 0.0
    skin = 0
    for r, g, b in pixels:
        if r < 55 or g < 35 or b < 18:
            continue
        if r > g + 8 and r > b + 10 and abs(r - g) < 75 and 70 < r < 245:
            skin += 1
    return skin / len(pixels)


def _green_ratio(pil: Image.Image) -> float:
    thumb = pil.copy()
    thumb.thumbnail((96, 96), Image.Resampling.BILINEAR)
    pixels = list(thumb.convert("RGB").getdata())
    if not pixels:
        return 0.0
    green = sum(1 for r, g, b in pixels if g > r + 10 and g > b + 6 and g > 70)
    return green / len(pixels)


def _is_sky_pixel(r: int, g: int, b: int, y_norm: float) -> bool:
    if y_norm > 0.38:
        return False
    if r > 155 and g > 148 and b > 132 and abs(r - g) < 40:
        return True
    return y_norm < 0.30 and r > 130 and g > 125 and b > 115


def _sky_ratio(pil: Image.Image) -> float:
    thumb = pil.copy()
    thumb.thumbnail((80, 80), Image.Resampling.BILINEAR)
    pixels = list(thumb.convert("RGB").getdata())
    if not pixels:
        return 0.0
    h = thumb.size[1]
    sky = 0
    for i, (r, g, b) in enumerate(pixels):
        y_norm = (i // thumb.size[0]) / max(h, 1)
        if _is_sky_pixel(r, g, b, y_norm):
            sky += 1
    return sky / len(pixels)


def _band_green_ratio(pil: Image.Image, y_px: int, band: range) -> float:
    if not band:
        return 0.0
    green = 0
    for px in band:
        r, g, b = pil.convert("RGB").getpixel((px, y_px))
        if g > r + 10 and g > b + 8 and g > 55:
            green += 1
    return green / len(band)


def _estimate_torso_top_y(pil: Image.Image, person: dict[str, float]) -> float:
    """Yuqori kiyim boshlanishi — osmon/daraxt/bosh emas, ko'krak qismi."""
    thumb = pil.copy()
    thumb.thumbnail((240, 480), Image.Resampling.BILINEAR)
    w, h = thumb.size
    cx = int(w * (person["x"] + person["w"] / 2))
    band = range(max(0, cx - int(w * 0.10)), min(w, cx + int(w * 0.10)))
    min_scan = int(h * max(0.18, float(person["y"]) + float(person["h"]) * 0.16))
    floor_y = _clamp01(float(person["y"]) + float(person["h"]) * 0.20)

    for py in range(min_scan, int(h * 0.56)):
        y_norm = py / h
        if _band_green_ratio(thumb, py, band) > 0.42:
            continue
        sky = 0
        body = 0
        for px in band:
            r, g, b = thumb.convert("RGB").getpixel((px, py))
            if _is_sky_pixel(r, g, b, y_norm):
                sky += 1
                continue
            if g > r + 18 and g > b + 12:
                continue
            body += 1
        band_n = max(len(band), 1)
        if body >= band_n * 0.30 and sky <= band_n * 0.22:
            return max(floor_y, _clamp01(py / h))

    return floor_y


def estimate_person_silhouette_bbox(pil: Image.Image) -> dict[str, float]:
    """Foreground person vs grass/sky — percentile bbox ignores side trees."""
    thumb = pil.copy()
    thumb.thumbnail((360, 720), Image.Resampling.BILINEAR)
    w, h = thumb.size
    if w < 20 or h < 20:
        return {"x": 0.24, "y": 0.06, "w": 0.52, "h": 0.86}

    rgb = thumb.convert("RGB")
    pixels = rgb.load()
    border: list[tuple[int, int, int]] = []
    for x in range(0, w, 4):
        border.append(pixels[x, 0])
        border.append(pixels[x, h - 1])
    for y in range(0, h, 4):
        border.append(pixels[0, y])
        border.append(pixels[w - 1, y])

    bg = (
        sum(c[0] for c in border) / len(border),
        sum(c[1] for c in border) / len(border),
        sum(c[2] for c in border) / len(border),
    )
    bg_int = (int(bg[0]), int(bg[1]), int(bg[2]))
    thresh = 34

    band_lo = int(w * 0.20)
    band_hi = int(w * 0.80)
    fg_x: list[int] = []
    fg_y: list[int] = []

    for py in range(h):
        y_norm = py / h
        for px in range(band_lo, band_hi):
            r, g, b = pixels[px, py]
            if _is_sky_pixel(r, g, b, y_norm):
                continue
            if _rgb_dist((r, g, b), bg_int) < thresh:
                continue
            if g > r + 20 and g > b + 14 and py > h * 0.55:
                continue
            fg_x.append(px)
            fg_y.append(py)

    if len(fg_x) < max(60, int(w * h * 0.02)):
        return {"x": 0.30, "y": 0.08, "w": 0.40, "h": 0.84}

    fg_x.sort()
    fg_y.sort()
    x_lo = fg_x[int(len(fg_x) * 0.08)]
    x_hi = fg_x[int(len(fg_x) * 0.92)]
    y_lo = fg_y[int(len(fg_y) * 0.14)]
    y_hi = fg_y[int(len(fg_y) * 0.98)]
    y_lo = max(y_lo, int(h * 0.10))
    y_hi = min(h - 1, max(y_hi, int(h * 0.90)))

    margin_x = max(2, int((x_hi - x_lo) * 0.03))
    margin_y = max(2, int((y_hi - y_lo) * 0.02))
    x_lo = max(0, x_lo - margin_x)
    y_lo = max(0, y_lo - margin_y)
    x_hi = min(w - 1, x_hi + margin_x)
    y_hi = min(h - 1, y_hi + margin_y)

    return {
        "x": _clamp01(x_lo / w),
        "y": _clamp01(y_lo / h),
        "w": _clamp01(max(0.22, (x_hi - x_lo + 1) / w)),
        "h": _clamp01(max(0.35, (y_hi - y_lo + 1) / h)),
    }


def estimate_subject_column(pil: Image.Image) -> tuple[float, float]:
    person = estimate_person_silhouette_bbox(pil)
    cx = person["x"] + person["w"] / 2
    return _clamp01(cx), min(0.78, max(0.38, person["w"]))


def tighten_bbox_to_content(pil: Image.Image, bbox: dict[str, float]) -> dict[str, float]:
    fw, fh = pil.size
    x0 = int(bbox["x"] * fw)
    y0 = int(bbox["y"] * fh)
    x1 = max(x0 + 8, int((bbox["x"] + bbox["w"]) * fw))
    y1 = max(y0 + 8, int((bbox["y"] + bbox["h"]) * fh))
    region = pil.crop((x0, y0, min(fw, x1), min(fh, y1))).convert("RGB")
    rw, rh = region.size
    if rw < 12 or rh < 12:
        return bbox

    gray = region.convert("L")
    corners = (
        gray.getpixel((0, 0)),
        gray.getpixel((rw - 1, 0)),
        gray.getpixel((0, rh - 1)),
        gray.getpixel((rw - 1, rh - 1)),
    )
    bg = sum(corners) / 4
    threshold = 22

    min_px, min_py = rw, rh
    max_px, max_py = 0, 0
    found = False
    for py in range(rh):
        for px in range(rw):
            r, g, b = region.getpixel((px, py))
            if g > r + 14 and g > b + 10 and g > 75:
                continue
            if abs(gray.getpixel((px, py)) - bg) > threshold:
                found = True
                min_px = min(min_px, px)
                min_py = min(min_py, py)
                max_px = max(max_px, px)
                max_py = max(max_py, py)

    if not found:
        return bbox
    if max_px - min_px < rw * 0.10 or max_py - min_py < rh * 0.10:
        return bbox

    pad_x = max(2, int((max_px - min_px) * 0.05))
    pad_y = max(2, int((max_py - min_py) * 0.05))
    min_px = max(0, min_px - pad_x)
    min_py = max(0, min_py - pad_y)
    max_px = min(rw - 1, max_px + pad_x)
    max_py = min(rh - 1, max_py + pad_y)

    nx = bbox["x"] + (min_px / rw) * bbox["w"]
    ny = bbox["y"] + (min_py / rh) * bbox["h"]
    nw = ((max_px - min_px + 1) / rw) * bbox["w"]
    nh = ((max_py - min_py + 1) / rh) * bbox["h"]
    return {
        "x": _clamp01(nx),
        "y": _clamp01(ny),
        "w": _clamp01(max(0.12, nw)),
        "h": _clamp01(max(0.12, nh)),
    }


def _zone_from_person(
    person: dict[str, float],
    *,
    x_off: float,
    y_off: float,
    w_frac: float,
    h_frac: float,
) -> dict[str, float]:
    return clamp_bbox_in_frame(
        {
            "x": person["x"] + person["w"] * x_off,
            "y": person["y"] + person["h"] * y_off,
            "w": person["w"] * w_frac,
            "h": person["h"] * h_frac,
        }
    )


def build_body_part_detections(
    pil: Image.Image,
    *,
    color: str | None = None,
    material: str | None = None,
) -> list[dict[str, Any]]:
    """Deterministic Taobao slots: torso top + pants — tor, fon emas."""
    person = estimate_person_silhouette_bbox(pil)
    torso_y = _estimate_torso_top_y(pil, person)
    body_bottom = float(person["y"]) + float(person["h"])
    cx = person["x"] + person["w"] / 2
    core_w = min(max(person["w"] * 0.58, 0.26), 0.40)
    core_y = max(float(person["y"]) + float(person["h"]) * 0.18, torso_y)
    core_h = max(0.42, body_bottom - core_y)
    core = {
        "x": _clamp01(cx - core_w / 2),
        "y": _clamp01(core_y),
        "w": core_w,
        "h": _clamp01(core_h),
    }
    slots = [
        ("top", "top", "Futbolka", 0.05, 0.02, 0.90, 0.28),
        ("pants", "pants", "Shim", 0.04, 0.28, 0.92, 0.40),
        ("shoes", "shoes", "Oyoq kiyim", 0.12, 0.66, 0.76, 0.28),
    ]

    items: list[dict[str, Any]] = []
    for slot_id, category, label, xo, yo, wf, hf in slots:
        bbox = _zone_from_person(core, x_off=xo, y_off=yo, w_frac=wf, h_frac=hf)
        bbox = tighten_bbox_to_content(pil, bbox)
        bbox = clamp_bbox_in_frame(bbox)
        if is_invalid_outfit_bbox(bbox):
            continue

        fw, fh = pil.size
        crop = pil.crop(
            (
                int(bbox["x"] * fw),
                int(bbox["y"] * fh),
                int((bbox["x"] + bbox["w"]) * fw),
                int((bbox["y"] + bbox["h"]) * fh),
            )
        )
        if category == "top" and (_sky_ratio(crop) > 0.28 or float(bbox["y"]) < 0.12):
            bbox = _zone_from_person(core, x_off=0.06, y_off=0.04, w_frac=0.88, h_frac=0.26)
            bbox = tighten_bbox_to_content(pil, bbox)
            crop = pil.crop(
                (
                    int(bbox["x"] * fw),
                    int(bbox["y"] * fh),
                    int((bbox["x"] + bbox["w"]) * fw),
                    int((bbox["y"] + bbox["h"]) * fh),
                )
            )
            if _sky_ratio(crop) > 0.32:
                continue

        green_limit = 0.55 if category == "shoes" else 0.42
        crop_green = _green_ratio(crop)
        crop_sky = _sky_ratio(crop)
        if crop_green > green_limit and category != "shoes":
            if category == "top" and crop_sky < 0.14:
                # Fon daraxt — markazdagi futbolka/sviterni saqlaymiz
                pass
            elif category == "pants":
                bbox = _zone_from_person(core, x_off=0.06, y_off=0.28, w_frac=0.88, h_frac=0.38)
                bbox = tighten_bbox_to_content(pil, bbox)
            else:
                continue

        if category == "top" and float(bbox["y"]) < 0.16:
            continue

        items.append(
            {
                "id": slot_id,
                "label_uz": label,
                "category": category,
                "color": color,
                "material": material,
                "search_query": f"{color or ''} {label}".strip(),
                "bbox": bbox,
                "body_slot": True,
            }
        )

    have = {str(item.get("id") or "") for item in items}
    if "shoes" not in have:
        shoe_w = min(max(core_w * 0.82, 0.22), 0.38)
        shoe_y = _clamp01(max(body_bottom - 0.16, person["y"] + person["h"] * 0.78))
        shoe_h = _clamp01(min(0.20, max(0.14, 0.99 - shoe_y)))
        shoes_bbox = clamp_bbox_in_frame(
            {
                "x": _clamp01(cx - shoe_w / 2),
                "y": shoe_y,
                "w": shoe_w,
                "h": shoe_h,
            }
        )
        shoes_bbox = tighten_bbox_to_content(pil, shoes_bbox)
        shoes_area = _bbox_area(shoes_bbox)
        if shoes_area < 0.035:
            shoes_bbox = clamp_bbox_in_frame(
                {
                    "x": _clamp01(cx - shoe_w / 2),
                    "y": max(0.0, shoe_y - 0.02),
                    "w": shoe_w,
                    "h": max(shoe_h, 0.16),
                }
            )
        if not is_invalid_outfit_bbox(shoes_bbox) or shoes_area >= 0.030:
            items.append(
                {
                    "id": "shoes",
                    "label_uz": "Oyoq kiyim",
                    "category": "shoes",
                    "color": color,
                    "material": material,
                    "search_query": f"{color or ''} Oyoq kiyim".strip(),
                    "bbox": shoes_bbox,
                    "body_slot": True,
                }
            )

    return items[:3]


def snap_bbox_to_subject(
    bbox: dict[str, float],
    center_x: float,
    subject_w: float,
    *,
    category: str | None = None,
) -> dict[str, float]:
    sub_w = min(0.78, max(0.36, subject_w))
    sub_x = _clamp01(center_x - sub_w / 2)
    if sub_x + sub_w > 0.94:
        sub_x = max(0.06, 0.94 - sub_w)

    bx, bw, by, bh = bbox["x"], bbox["w"], bbox["y"], bbox["h"]
    overlap = max(0.0, min(bx + bw, sub_x + sub_w) - max(bx, sub_x))
    if overlap >= bw * 0.40:
        nx = max(bx, sub_x)
        nw = min(bx + bw, sub_x + sub_w) - nx
    else:
        nw = min(max(bw, 0.28), sub_w * 0.94)
        nx = sub_x + (sub_w - nw) / 2

    out = {"x": _clamp01(nx), "y": _clamp01(by), "w": _clamp01(nw), "h": _clamp01(bh)}
    return clamp_bbox_vertical_for_category(out, category)


def clamp_bbox_vertical_for_category(bbox: dict[str, float], category: str | None) -> dict[str, float]:
    cat = (category or "").lower()
    x, y, w, h = bbox["x"], bbox["y"], bbox["w"], bbox["h"]

    if cat in ("pants", "shim"):
        if y < 0.34:
            y = max(0.34, y)
            h = min(h, 0.48)
    elif cat in ("shoes",):
        if y < 0.58:
            y = max(y, 0.58)
            h = min(h, 0.34)
    elif cat in ("top", "shirt", "ko'ylak"):
        if y > 0.50:
            y = 0.16
        h = min(max(h, 0.18), 0.40)

    if y + h > 1:
        h = max(0.12, 1 - y)
    return {"x": _clamp01(x), "y": _clamp01(y), "w": _clamp01(w), "h": _clamp01(h)}


def clamp_bbox_in_frame(bbox: dict[str, float]) -> dict[str, float]:
    x, y, w, h = bbox["x"], bbox["y"], bbox["w"], bbox["h"]
    w = min(w, 0.82)
    x = max(0.08, min(x, 0.92 - w))
    y = max(0.02, min(y, 0.96 - h))
    return {"x": _clamp01(x), "y": _clamp01(y), "w": _clamp01(w), "h": _clamp01(h)}


def dedupe_detections(items: list[dict[str, Any]], *, iou_thresh: float = 0.55) -> list[dict[str, Any]]:
    kept: list[dict[str, Any]] = []
    for item in items:
        bbox = item.get("bbox") or {}
        if any(_bbox_iou(bbox, k.get("bbox") or {}) >= iou_thresh for k in kept):
            continue
        kept.append(item)
    return kept


def filter_sky_detections(pil: Image.Image, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop head/sky/background crops — keep torso, pants, shoes only."""
    fw, fh = pil.size
    kept: list[dict[str, Any]] = []
    for item in items:
        bbox = item.get("bbox") or {}
        if is_invalid_outfit_bbox(bbox):
            continue
        cat = str(item.get("category") or item.get("id") or "")
        crop = pil.crop(
            (
                int(float(bbox["x"]) * fw),
                int(float(bbox["y"]) * fh),
                int((float(bbox["x"]) + float(bbox["w"])) * fw),
                int((float(bbox["y"]) + float(bbox["h"])) * fh),
            )
        )
        sky = _sky_ratio(crop)
        sky_limit = 0.34 if cat in ("top", "jacket", "shirt") else 0.48
        y = float(bbox.get("y", 0))
        h = float(bbox.get("h", 0))
        if sky > sky_limit:
            continue
        if cat in ("top", "jacket", "shirt") and y < 0.18:
            continue
        if cat in ("top", "jacket", "shirt") and y < 0.24 and sky > 0.16:
            continue
        if cat in ("top", "jacket", "shirt") and y < 0.28 and _green_ratio(crop) > 0.38:
            continue
        kept.append(item)
    return kept


def merge_fashion_slots(
    primary: list[dict[str, Any]],
    fallback: list[dict[str, Any]],
    *,
    max_items: int = 4,
) -> list[dict[str, Any]]:
    """YOLOS slots first; fill missing top/pants/shoes from body zones."""
    order = ("top", "jacket", "pants", "shoes")
    by_slot: dict[str, dict[str, Any]] = {}
    for item in primary:
        slot = str(item.get("slot") or item.get("id") or "")
        bbox = item.get("bbox") or {}
        if not slot or is_invalid_outfit_bbox(bbox):
            continue
        if slot not in by_slot:
            by_slot[slot] = item
    for item in fallback:
        slot = str(item.get("slot") or item.get("id") or "")
        if not slot or slot in by_slot:
            continue
        by_slot[slot] = item
    out: list[dict[str, Any]] = []
    for key in order:
        if key in by_slot:
            out.append(by_slot[key])
    for item in by_slot.values():
        if item not in out:
            out.append(item)
    return out[:max_items]


def person_heuristic_zones(
    *,
    center_x: float,
    subject_w: float,
    color: str | None,
    material: str | None,
    pil: Image.Image | None = None,
) -> list[dict[str, Any]]:
    if pil is not None:
        return build_body_part_detections(pil, color=color, material=material)

    sw = min(0.68, max(0.42, subject_w))
    sx = _clamp01(center_x - sw / 2)
    zones = [
        ("top", "top", {"x": sx + sw * 0.08, "y": 0.22, "w": sw * 0.84, "h": 0.26}),
        ("pants", "pants", {"x": sx + sw * 0.06, "y": 0.46, "w": sw * 0.88, "h": 0.36}),
        ("shoes", "shoes", {"x": sx + sw * 0.14, "y": 0.68, "w": sw * 0.72, "h": 0.24}),
    ]
    out: list[dict[str, Any]] = []
    labels = {"top": "Yuqori kiyim", "pants": "Shim", "shoes": "Oyoq kiyim"}
    for slot_id, cat, bbox in zones:
        label = labels.get(cat, "Mahsulot")
        out.append(
            {
                "id": slot_id,
                "label_uz": label,
                "category": cat,
                "color": color,
                "material": material,
                "search_query": f"{color or ''} {label}".strip(),
                "bbox": clamp_bbox_in_frame(bbox),
                "body_slot": True,
            }
        )
    return out


def bbox_inside_person(bbox: dict[str, float], person: dict[str, float], *, min_overlap: float = 0.55) -> bool:
    x0 = max(bbox["x"], person["x"])
    y0 = max(bbox["y"], person["y"])
    x1 = min(bbox["x"] + bbox["w"], person["x"] + person["w"])
    y1 = min(bbox["y"] + bbox["h"], person["y"] + person["h"])
    if x1 <= x0 or y1 <= y0:
        return False
    inter = (x1 - x0) * (y1 - y0)
    return inter / max(_bbox_area(bbox), 1e-6) >= min_overlap


def refine_outfit_detections(pil: Image.Image, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not items:
        return items
    if any(item.get("yolos") or item.get("body_slot") for item in items):
        return items[:4]

    person = estimate_person_silhouette_bbox(pil)
    cx, sw = estimate_subject_column(pil)
    refined: list[dict[str, Any]] = []
    for item in items:
        bbox = dict(item.get("bbox") or {})
        if not bbox_inside_person(bbox, person, min_overlap=0.45):
            continue
        if is_invalid_outfit_bbox(bbox):
            continue
        cat = str(item.get("category") or "")
        bbox = snap_bbox_to_subject(bbox, cx, sw, category=cat)
        bbox = tighten_bbox_to_content(pil, bbox)
        bbox = clamp_bbox_in_frame(bbox)
        if is_invalid_outfit_bbox(bbox):
            continue
        refined.append({**item, "bbox": bbox})

    refined = dedupe_detections(refined)
    refined.sort(key=lambda d: float((d.get("bbox") or {}).get("y", 0)))
    return refined[:3]


def merge_groq_metadata(
    body_items: list[dict[str, Any]],
    groq_items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Copy color/category from vision model into body slots when labels match."""
    if not groq_items:
        return body_items
    by_cat: dict[str, dict[str, Any]] = {}
    for g in groq_items:
        cat = str(g.get("category") or "").lower()
        if cat:
            by_cat.setdefault(cat, g)
        for alias in ("top", "shirt", "pants", "shoes", "jacket"):
            if alias in str(g.get("label_uz") or "").lower() or alias in cat:
                by_cat.setdefault(alias, g)

    out: list[dict[str, Any]] = []
    for item in body_items:
        cat = str(item.get("category") or "").lower()
        g = by_cat.get(cat) or by_cat.get("shirt" if cat == "top" else cat)
        if not g:
            out.append(item)
            continue
        merged = dict(item)
        if g.get("color"):
            merged["color"] = g["color"]
        if g.get("search_query"):
            merged["search_query"] = g["search_query"]
        if g.get("material"):
            merged["material"] = g["material"]
        out.append(merged)
    return out
