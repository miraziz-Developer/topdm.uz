"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { VisualSearchHotspots } from "@/components/ai-visual-search/visual-search-hotspots";
import { bboxObjectPosition, mapBboxToContainRect, normalizeBbox, resolveBboxOverlaps } from "@/lib/bbox-layout";
import { cn } from "@/lib/utils";
import type { DetectedOutfitItem } from "@/types";

type PhotoDetectedRailProps = {
  previewUrl: string;
  items: DetectedOutfitItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

type LayoutBox = DetectedOutfitItem & { displayRect: { left: number; top: number; width: number; height: number } };

export function PhotoDetectedRail({ previewUrl, items, selectedId, onSelect }: PhotoDetectedRailProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const measure = useCallback(() => {
    const el = frameRef.current;
    if (!el) return;
    setFrameSize({ w: el.clientWidth, h: el.clientHeight });
  }, []);

  useEffect(() => {
    measure();
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const layoutItems = useMemo((): LayoutBox[] => {
    const bboxes = resolveBboxOverlaps(items.map((item) => normalizeBbox(item.bbox)));
    return items.map((item, index) => {
      const bbox = bboxes[index] ?? normalizeBbox(item.bbox);
      const rect = mapBboxToContainRect(frameSize.w, frameSize.h, naturalSize.w, naturalSize.h, bbox);
      return { ...item, bbox, displayRect: rect };
    });
  }, [frameSize.h, frameSize.w, items, naturalSize.h, naturalSize.w]);

  const hotspotItems = layoutItems.map((item) => ({
    id: item.id,
    label_uz: item.label_uz,
    displayRect: item.displayRect,
  }));

  return (
    <div className="mb-6 space-y-4 rounded-2xl border border-border-subtle bg-surface p-4">
      <div
        ref={frameRef}
        className="relative mx-auto aspect-[3/4] max-h-80 w-full max-w-xs overflow-hidden rounded-2xl bg-elevated"
      >
        <Image
          src={previewUrl}
          alt="Yuklangan rasm"
          fill
          unoptimized
          className="object-contain"
          onLoadingComplete={(img) => {
            setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
            measure();
          }}
        />
        <VisualSearchHotspots
          items={hotspotItems}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={onSelect}
          onHover={setHoveredId}
        />
      </div>

      <p className="text-center text-sm text-text-400">
        Taobao uslubi: nuqta yoki chip — xuddi shu rang va ko&apos;rinishdagi mahsulotlar qidiriladi
      </p>

      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {layoutItems.map((item) => {
          const chipActive = selectedId === item.id || hoveredId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={cn(
                "flex min-w-[100px] shrink-0 flex-col items-center gap-2 rounded-xl border p-2 transition-all duration-300",
                chipActive
                  ? "border-electric-500 bg-electric-500/10 shadow-[0_0_12px_rgba(0,102,255,0.2)]"
                  : "border-border-subtle hover:border-electric-500/40",
              )}
              aria-pressed={selectedId === item.id}
            >
              <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-elevated">
                <Image
                  src={item.thumbnail_url || previewUrl}
                  alt={item.label_uz}
                  fill
                  unoptimized
                  className="object-cover"
                  style={
                    item.thumbnail_url
                      ? undefined
                      : {
                          objectPosition: bboxObjectPosition(item.bbox),
                          transform: `scale(${Math.min(2.2, 1 / Math.max(item.bbox.w, item.bbox.h, 0.25))})`,
                          transformOrigin: bboxObjectPosition(item.bbox),
                        }
                  }
                  sizes="64px"
                />
              </div>
              <span className="max-w-[96px] truncate text-xs font-medium text-text-100">{item.label_uz}</span>
              {item.color ? (
                <span className="max-w-[96px] truncate text-[10px] capitalize text-electric-400">{item.color}</span>
              ) : null}
              <span className="text-[10px] text-text-400">{item.total} ta</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
