"use client";

import { cn } from "@/lib/utils";
import type { PixelRect } from "@/lib/bbox-layout";

export type HotspotLayoutItem = {
  id: string;
  displayRect: PixelRect;
};

type VisualSearchHotspotsProps = {
  items: HotspotLayoutItem[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
};

export function VisualSearchHotspots({
  items,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: VisualSearchHotspotsProps) {
  return (
    <>
      {items.map((item) => {
        const active = selectedId === item.id || hoveredId === item.id;
        const centerX = item.displayRect.left + item.displayRect.width / 2;
        const centerY = item.displayRect.top + item.displayRect.height / 2;

        return (
          <div key={item.id}>
            <div
              className={cn(
                "pointer-events-none absolute z-[8] rounded-lg border-2 transition-all duration-300",
                active
                  ? "border-electric-500 bg-electric-500/15 shadow-[0_0_16px_rgba(0,102,255,0.35)]"
                  : "border-electric-500/45 bg-electric-500/5",
              )}
              style={{
                left: item.displayRect.left,
                top: item.displayRect.top,
                width: Math.max(item.displayRect.width, 8),
                height: Math.max(item.displayRect.height, 8),
              }}
              aria-hidden
            />

            <button
              type="button"
              onClick={() => onSelect(item.id)}
              onMouseEnter={() => onHover(item.id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(item.id)}
              onBlur={() => onHover(null)}
              className={cn(
                "absolute z-20 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-500",
              )}
              style={{ left: centerX, top: centerY }}
              aria-label="Rasm qismini tanlash"
              aria-pressed={selectedId === item.id}
            >
              <span
                className={cn(
                  "absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500/30",
                  !active && "opacity-40",
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "relative h-3 w-3 rounded-full bg-electric-500 shadow-[0_0_14px_rgba(0,102,255,0.85)]",
                  active && "h-3.5 w-3.5 ring-2 ring-white/90",
                )}
              />
            </button>
          </div>
        );
      })}
    </>
  );
}
