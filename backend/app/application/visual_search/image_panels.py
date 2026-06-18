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


def _row_is_separator(pil: Image.Image, py: int, *, dark_thresh: int = 30) -> bool:
    w, _ = pil.size
    if w < 4:
        return False
    dark = 0
    step = max(1, w // 40)
    cols = list(range(0, w, step))
    for px in cols:
        r, g, b = pil.convert("RGB").getpixel((px, py))
        if r < dark_thresh and g < dark_thresh and b < dark_thresh:
            dark += 1
    return dark / max(1, len(cols)) >= 0.78


def _panel_content_ratio(pil: Image.Image) -> float:
    thumb = pil.copy()
    thumb.thumbnail((96, 96), Image.Resampling.BILINEAR)
    pixels = list(thumb.convert("RGB").getdata())
    if not pixels:
        return 0.0
    active = sum(1 for r, g, b in pixels if r + g + b > 55)
    return active / len(pixels)


def find_vertical_panels(pil: Image.Image) -> list[ImagePanel]:
    """Kollaj (tufli + odam) — qora chiziqlar bo'yicha panellarga bo'lish."""
    w, h = pil.size
    if w <= 0 or h <= 0:
        return [ImagePanel(0, 0, 1, 1)]
    if h / w < 1.12:
        return [ImagePanel(0, 0, 1, 1)]

    thumb = pil.copy()
    thumb.thumbnail((min(160, w), min(720, h)), Image.Resampling.BILINEAR)
    _, th = thumb.size

    sep_mask = [_row_is_separator(thumb, py) for py in range(th)]

    segments: list[tuple[int, int]] = []
    start: int | None = None
    for py, is_sep in enumerate(sep_mask):
        if not is_sep:
            if start is None:
                start = py
            continue
        if start is not None and py - start >= max(3, int(th * 0.10)):
            segments.append((start, py))
        start = None
    if start is not None and th - start >= max(3, int(th * 0.10)):
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
        panels.append(ImagePanel(0, _clamp01(ny), 1, _clamp01(nh)))

    return panels if len(panels) >= 2 else [ImagePanel(0, 0, 1, 1)]


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
    from app.application.visual_search.bbox_refine import clamp_bbox_in_frame, tighten_bbox_to_content

    inner = {"x": 0.06, "y": 0.05, "w": 0.88, "h": 0.90}
    panel_pil = crop_panel(pil, panel)
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
