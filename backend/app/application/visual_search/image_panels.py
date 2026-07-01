"""Vertical collage / stitched image panels — bbox global koordinataga."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from PIL import Image


@dataclass(frozen=True, slots=True)
class ImagePanel:
    """Normalized panel region (0–1) within full frame."""

    x: float
    y: float
    w: float
    h: float


def _clamp01(v: float) -> float:
    return max(0.0, min(1.0, v))


def _row_dark_ratio(pil: Image.Image, py: int, *, dark_thresh: int = 24) -> float:
    w, _ = pil.size
    if w < 8:
        return 0.0
    dark = 0
    cols = list(range(0, w, max(1, w // 100)))
    for px in cols:
        r, g, b = pil.convert("RGB").getpixel((px, py))
        if r < dark_thresh and g < dark_thresh and b < dark_thresh:
            dark += 1
    return dark / max(1, len(cols))


def _row_is_separator(pil: Image.Image, py: int, *, dark_thresh: int = 24) -> bool:
    """Faqat deyarli qora gorizontal chiziq (kollaj tutqichi)."""
    return _row_dark_ratio(pil, py, dark_thresh=dark_thresh) >= 0.90


def _panel_content_ratio(pil: Image.Image) -> float:
    thumb = pil.copy()
    thumb.thumbnail((96, 96), Image.Resampling.BILINEAR)
    pixels = list(thumb.convert("RGB").getdata())
    if not pixels:
        return 0.0
    active = sum(1 for r, g, b in pixels if r + g + b > 55)
    return active / len(pixels)


def _panel_color_signature(pil: Image.Image) -> tuple[int, int, int]:
    thumb = pil.copy()
    thumb.thumbnail((48, 48), Image.Resampling.BILINEAR)
    pixels = list(thumb.convert("RGB").getdata())
    if not pixels:
        return (0, 0, 0)
    r = sum(p[0] for p in pixels) // len(pixels)
    g = sum(p[1] for p in pixels) // len(pixels)
    b = sum(p[2] for p in pixels) // len(pixels)
    return (r, g, b)


def _color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def is_horizontal_strip_grid(panels: list[ImagePanel]) -> bool:
    """Noto'g'ri bo'linish: butun kenglikdagi ingichka qatorlar (bitta rasm kesilgan)."""
    if len(panels) < 2:
        return False
    if not all(p.w >= 0.88 and p.x <= 0.06 for p in panels):
        return False
    if not all(p.h <= 0.48 for p in panels):
        return False
    return sum(p.h for p in panels) >= 0.75


def panels_look_like_true_collage(pil: Image.Image, panels: list[ImagePanel]) -> bool:
    """Haqiqiy vertikal kollaj: turli kontent yoki aniq qora tutqichlar."""
    if len(panels) < 2:
        return False
    if is_horizontal_strip_grid(panels):
        return False

    sigs = []
    for panel in panels:
        crop = crop_panel(pil, panel)
        if _panel_content_ratio(crop) < 0.08:
            return False
        sigs.append(_panel_color_signature(crop))

    if len(sigs) >= 2:
        dists = [_color_distance(sigs[i], sigs[i + 1]) for i in range(len(sigs) - 1)]
        if max(dists) < 28:
            return False

    return True


def find_vertical_panels(pil: Image.Image) -> list[ImagePanel]:
    """Kollaj (tufli + odam) — qora gorizontal tutqichlar bo'yicha panellarga bo'lish."""
    w, h = pil.size
    if w <= 0 or h <= 0:
        return [ImagePanel(0, 0, 1, 1)]
    if h / w < 1.12:
        return [ImagePanel(0, 0, 1, 1)]

    thumb = pil.copy()
    thumb.thumbnail((min(200, w), min(900, h)), Image.Resampling.BILINEAR)
    tw, th = thumb.size

    sep_mask = [_row_is_separator(thumb, py) for py in range(th)]

    segments: list[tuple[int, int]] = []
    start: int | None = None
    min_seg = max(5, int(th * 0.14))
    for py, is_sep in enumerate(sep_mask):
        if not is_sep:
            if start is None:
                start = py
            continue
        if start is not None and py - start >= min_seg:
            segments.append((start, py))
        start = None
    if start is not None and th - start >= min_seg:
        segments.append((start, th - 1))

    if len(segments) < 2:
        return [ImagePanel(0, 0, 1, 1)]

    panels: list[ImagePanel] = []
    for y0_px, y1_px in segments:
        ny = y0_px / th
        nh = (y1_px - y0_px + 1) / th
        panel_pil = pil.crop((0, int(ny * h), w, int(min(h, (ny + nh) * h))))
        if _panel_content_ratio(panel_pil) < 0.08:
            continue
        if nh < 0.12:
            continue
        panels.append(ImagePanel(0, _clamp01(ny), 1, _clamp01(nh)))

    if len(panels) < 2:
        return [ImagePanel(0, 0, 1, 1)]

    if not panels_look_like_true_collage(pil, panels):
        return [ImagePanel(0, 0, 1, 1)]

    return panels


def crop_panel(pil: Image.Image, panel: ImagePanel) -> Image.Image:
    w, h = pil.size
    x0 = int(panel.x * w)
    y0 = int(panel.y * h)
    x1 = int(min(w, (panel.x + panel.w) * w))
    y1 = int(min(h, (panel.y + panel.h) * h))
    if x1 - x0 < 8 or y1 - y0 < 8:
        return pil
    return pil.crop((x0, y0, x1, y1))


def local_bbox_to_global(panel: ImagePanel, bbox: dict[str, float]) -> dict[str, float]:
    lx = float(bbox.get("x", 0))
    ly = float(bbox.get("y", 0))
    lw = float(bbox.get("w", 0.2))
    lh = float(bbox.get("h", 0.2))
    gx = panel.x + lx * panel.w
    gy = panel.y + ly * panel.h
    return {
        "x": _clamp01(gx),
        "y": _clamp01(gy),
        "w": _clamp01(min(lw * panel.w, 1 - gx)),
        "h": _clamp01(min(lh * panel.h, 1 - gy)),
    }


def panel_product_bbox(panel: ImagePanel, pil: Image.Image) -> dict[str, float]:
    from app.application.visual_search.bbox_refine import (
        clamp_bbox_in_frame,
        estimate_foreground_product_bbox,
        tighten_bbox_to_content,
    )

    panel_pil = crop_panel(pil, panel)
    inner = estimate_foreground_product_bbox(panel_pil)
    bbox = tighten_bbox_to_content(panel_pil, inner)
    bbox = clamp_bbox_in_frame(bbox)
    return local_bbox_to_global(panel, bbox)


def map_detections_to_global(
    panel: ImagePanel,
    detections: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for det in detections:
        bbox = det.get("bbox")
        if not bbox:
            continue
        out.append({**det, "bbox": local_bbox_to_global(panel, bbox), "panel": True})
    return out
