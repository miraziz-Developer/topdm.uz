"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { VisualSearchHotspots } from "@/components/ai-visual-search/visual-search-hotspots";
import { cropImageFromBbox } from "@/lib/crop-image";
import {
  mapBboxToContainRect,
  normalizeBbox,
  pixelToNormalizedBbox,
  type NormalizedBbox,
} from "@/lib/bbox-layout";
import { cn } from "@/lib/utils";
import type { DetectedOutfitItem } from "@/types";

type PhotoDetectedRailProps = {
  previewUrl: string;
  items: DetectedOutfitItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onManualSelect?: (bbox: NormalizedBbox) => void;
};

type LayoutBox = DetectedOutfitItem & { displayRect: { left: number; top: number; width: number; height: number } };

export function PhotoDetectedRail({ previewUrl, items, selectedId, onSelect, onManualSelect }: PhotoDetectedRailProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [chipUrls, setChipUrls] = useState<Record<string, string>>({});

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

  useEffect(() => {
    let cancelled = false;
    async function loadChips() {
      const next: Record<string, string> = {};
      for (const item of items) {
        if (!item.bbox) continue;
        try {
          next[item.id] = await cropImageFromBbox(previewUrl, normalizeBbox(item.bbox), 280);
        } catch {
          if (item.thumbnail_url) next[item.id] = item.thumbnail_url;
        }
      }
      if (!cancelled) setChipUrls(next);
    }
    void loadChips();
    return () => {
      cancelled = true;
    };
  }, [items, previewUrl]);

  const layoutItems = useMemo((): LayoutBox[] => {
    return items.map((item) => {
      const bbox = normalizeBbox(item.bbox);
      const rect = mapBboxToContainRect(frameSize.w, frameSize.h, naturalSize.w, naturalSize.h, bbox);
      return { ...item, bbox, displayRect: rect };
    });
  }, [frameSize.h, frameSize.w, items, naturalSize.h, naturalSize.w]);

  const hotspotItems = layoutItems.map((item) => ({
    id: item.id,
    displayRect: item.displayRect,
  }));

  const handleFrameClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!onManualSelect) return;
      const target = event.target as HTMLElement;
      if (target.closest("button")) return;
      const bbox = pixelToNormalizedBbox(
        frameSize.w,
        frameSize.h,
        naturalSize.w,
        naturalSize.h,
        event.nativeEvent.offsetX,
        event.nativeEvent.offsetY,
      );
      onManualSelect(bbox);
    },
    [frameSize.h, frameSize.w, naturalSize.h, naturalSize.w, onManualSelect],
  );

  return (
    <div className="mb-6 space-y-4 rounded-2xl border border-border-subtle bg-surface p-4">
      <p className="text-center text-xs text-text-400">
        Nuqta yoki ramka tanlang — faqat shu qism rasmi bo&apos;yicha qidiriladi
      </p>

      <div
        ref={frameRef}
        className="relative mx-auto aspect-[3/4] max-h-80 w-full max-w-xs cursor-crosshair overflow-hidden rounded-2xl bg-elevated"
        onClick={handleFrameClick}
      >
        <Image
          src={previewUrl}
          alt="Yuklangan rasm"
          fill
          unoptimized
          className="pointer-events-none object-contain"
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
        Tanlangan qism faqat rasm mosligi bo&apos;yicha qidiriladi
      </p>

      <div className="flex justify-center gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {layoutItems.map((item) => {
          const chipActive = selectedId === item.id || hoveredId === item.id;
          const cropSrc = chipUrls[item.id] || item.thumbnail_url || previewUrl;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={cn(
                "shrink-0 rounded-xl border-2 p-1 transition-all duration-300",
                chipActive
                  ? "border-electric-500 bg-electric-500/10 shadow-[0_0_12px_rgba(0,102,255,0.25)]"
                  : "border-border-subtle hover:border-electric-500/40",
              )}
              aria-pressed={selectedId === item.id}
              aria-label="Rasm qismi"
            >
              <div className="relative h-20 w-20 overflow-hidden rounded-lg bg-elevated sm:h-24 sm:w-24">
                <Image src={cropSrc} alt="" fill unoptimized className="object-cover" sizes="96px" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
