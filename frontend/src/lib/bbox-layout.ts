/** Normalized bounding box (0–1), top-left origin. */
export type NormalizedBbox = { x: number; y: number; w: number; h: number };

export type PixelRect = { left: number; top: number; width: number; height: number };

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function normalizeBbox(raw: Partial<NormalizedBbox>): NormalizedBbox {
  let x = clamp01(Number(raw.x ?? 0));
  let y = clamp01(Number(raw.y ?? 0));
  let w = clamp01(Number(raw.w ?? 0.2));
  let h = clamp01(Number(raw.h ?? 0.2));
  if (x + w > 1) w = Math.max(0.08, 1 - x);
  if (y + h > 1) h = Math.max(0.08, 1 - y);
  return { x, y, w, h };
}

function area(b: NormalizedBbox): number {
  return b.w * b.h;
}

function iou(a: NormalizedBbox, b: NormalizedBbox): number {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  if (x1 <= x0 || y1 <= y0) return 0;
  const inter = (x1 - x0) * (y1 - y0);
  const union = area(a) + area(b) - inter;
  return union > 0 ? inter / union : 0;
}

/** True when `inner` is fully inside `outer` (nested layer, e.g. shirt under jacket). */
export function isNestedBbox(inner: NormalizedBbox, outer: NormalizedBbox, margin = 0.02): boolean {
  return (
    inner.x >= outer.x - margin &&
    inner.y >= outer.y - margin &&
    inner.x + inner.w <= outer.x + outer.w + margin &&
    inner.y + inner.h <= outer.y + outer.h + margin &&
    area(inner) < area(outer) * 0.92
  );
}

/**
 * Separate accidental overlaps from vision models while preserving intentional nesting.
 */
export function resolveBboxOverlaps(items: NormalizedBbox[], minGap = 0.012): NormalizedBbox[] {
  const boxes = items.map(normalizeBbox);
  const order = boxes.map((_, i) => i).sort((a, b) => area(boxes[b]) - area(boxes[a]));

  for (let oi = 0; oi < order.length; oi++) {
    for (let oj = oi + 1; oj < order.length; oj++) {
      const i = order[oi];
      const j = order[oj];
      const a = boxes[i];
      const b = boxes[j];
      if (iou(a, b) < 0.08) continue;
      if (isNestedBbox(a, b) || isNestedBbox(b, a)) continue;

      const smaller = area(a) <= area(b) ? i : j;
      const larger = smaller === i ? j : i;
      const s = boxes[smaller];
      const l = boxes[larger];

      const overlapY = Math.min(s.y + s.h, l.y + l.h) - Math.max(s.y, l.y);
      const overlapX = Math.min(s.x + s.w, l.x + l.w) - Math.max(s.x, l.x);

      if (overlapY > overlapX && overlapY > 0) {
        if (s.y + s.h / 2 <= l.y + l.h / 2) {
          s.y = Math.max(0, l.y - s.h - minGap);
        } else {
          s.y = Math.min(1 - s.h, l.y + l.h + minGap);
        }
      } else if (overlapX > 0) {
        if (s.x + s.w / 2 <= l.x + l.w / 2) {
          s.x = Math.max(0, l.x - s.w - minGap);
        } else {
          s.x = Math.min(1 - s.w, l.x + l.w + minGap);
        }
      }

      boxes[smaller] = normalizeBbox(s);
    }
  }

  return boxes;
}

/** Map normalized bbox to pixel rect inside an object-contain image frame. */
export function mapBboxToContainRect(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
  bbox: NormalizedBbox,
): PixelRect {
  if (!containerWidth || !containerHeight || !imageWidth || !imageHeight) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }

  const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);
  const renderedW = imageWidth * scale;
  const renderedH = imageHeight * scale;
  const offsetX = (containerWidth - renderedW) / 2;
  const offsetY = (containerHeight - renderedH) / 2;
  const b = normalizeBbox(bbox);

  return {
    left: offsetX + b.x * renderedW,
    top: offsetY + b.y * renderedH,
    width: b.w * renderedW,
    height: b.h * renderedH,
  };
}

/** CSS object-position to center a thumbnail crop on the detected region. */
export function bboxObjectPosition(bbox: NormalizedBbox): string {
  const b = normalizeBbox(bbox);
  const cx = (b.x + b.w / 2) * 100;
  const cy = (b.y + b.h / 2) * 100;
  return `${cx}% ${cy}%`;
}

/** Pixel center of a bbox rect (for hotspot anchors). */
export function bboxRectCenter(rect: PixelRect): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

/** object-contain ichidagi bosish nuqtasidan normalizatsiya qilingan ramka. */
export function pixelToNormalizedBbox(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
  px: number,
  py: number,
  regionSize = 0.24,
): NormalizedBbox {
  if (!containerWidth || !containerHeight || !imageWidth || !imageHeight) {
    return { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
  }
  const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);
  const renderedW = imageWidth * scale;
  const renderedH = imageHeight * scale;
  const offsetX = (containerWidth - renderedW) / 2;
  const offsetY = (containerHeight - renderedH) / 2;
  const nx = (px - offsetX) / renderedW;
  const ny = (py - offsetY) / renderedH;
  const half = regionSize / 2;
  return normalizeBbox({
    x: nx - half,
    y: ny - half,
    w: regionSize,
    h: regionSize,
  });
}
