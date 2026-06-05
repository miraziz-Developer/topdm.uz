"use client";

import { Loader2, Move, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  clampStoryPosition,
  coverScale,
  exportStoryImage,
  STORY_ASPECT,
  type StoryCropState,
} from "@/lib/story-crop";

type Props = {
  imageSrc: string;
  onCancel: () => void;
  onDone: (file: File) => void;
};

export function StoryAdjustEditor({ imageSrc, onCancel, onDone }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [mediaSize, setMediaSize] = useState<{ w: number; h: number } | null>(null);
  const [frameSize, setFrameSize] = useState({ w: 320, h: 568 });
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [exporting, setExporting] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setMediaSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setFrameSize({ w: rect.width, h: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clamped = mediaSize
    ? clampStoryPosition(position, mediaSize.w, mediaSize.h, frameSize.w, frameSize.h, zoom)
    : position;

  const displayScale = mediaSize ? coverScale(mediaSize.w, mediaSize.h, frameSize.w, frameSize.h) * zoom : 1;
  const drawnW = mediaSize ? mediaSize.w * displayScale : 0;
  const drawnH = mediaSize ? mediaSize.h * displayScale : 0;

  const onPointerDown = (e: React.PointerEvent) => {
    if (!mediaSize) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: clamped.x,
      originY: clamped.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !mediaSize) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const next = clampStoryPosition(
      { x: dragRef.current.originX + dx, y: dragRef.current.originY + dy },
      mediaSize.w,
      mediaSize.h,
      frameSize.w,
      frameSize.h,
      zoom,
    );
    setPosition(next);
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const onZoomChange = (value: number) => {
    if (!mediaSize) return;
    const nextZoom = Math.min(3, Math.max(1, value));
    setZoom(nextZoom);
    setPosition((prev) =>
      clampStoryPosition(prev, mediaSize.w, mediaSize.h, frameSize.w, frameSize.h, nextZoom),
    );
  };

  const handleExport = useCallback(async () => {
    if (!mediaSize) return;
    setExporting(true);
    try {
      const state: StoryCropState = {
        zoom,
        position: clampStoryPosition(position, mediaSize.w, mediaSize.h, frameSize.w, frameSize.h, zoom),
      };
      const blob = await exportStoryImage(imageSrc, frameSize.w, frameSize.h, state);
      const file = new File([blob], `story-${Date.now()}.jpg`, { type: "image/jpeg" });
      onDone(file);
    } finally {
      setExporting(false);
    }
  }, [frameSize.h, frameSize.w, imageSrc, mediaSize, onDone, position, zoom]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0a0c12]">
      <header className="flex items-center justify-between px-4 py-3 text-white">
        <button type="button" onClick={onCancel} className="text-sm font-semibold text-white/80 hover:text-white">
          Bekor
        </button>
        <p className="text-sm font-bold tracking-tight">Story joylashuvi</p>
        <button
          type="button"
          disabled={exporting || !mediaSize}
          onClick={() => void handleExport()}
          className="text-sm font-bold text-electric-400 hover:text-electric-300 disabled:opacity-40"
        >
          {exporting ? "…" : "Tayyor"}
        </button>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div
          ref={frameRef}
          className="relative w-full max-w-[min(100%,280px)] overflow-hidden rounded-3xl bg-black shadow-2xl ring-1 ring-white/10"
          style={{ aspectRatio: `${STORY_ASPECT}` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {mediaSize ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                width: drawnW,
                height: drawnH,
                transform: `translate(calc(-50% + ${clamped.x}px), calc(-50% + ${clamped.y}px))`,
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-white/50" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 rounded-3xl ring-2 ring-inset ring-white/20" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/50 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
        </div>

        <p className="mt-4 flex items-center gap-2 text-xs text-white/55">
          <Move className="h-3.5 w-3.5" />
          Surib joylashtiring · kattalashtirish pastda
        </p>
      </div>

      <footer className="space-y-3 border-t border-white/10 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3 text-white">
          <ZoomIn className="h-4 w-4 shrink-0 text-white/60" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => onZoomChange(Number(e.target.value))}
            className="h-2 flex-1 accent-electric-500"
            aria-label="Kattalashtirish"
          />
          <span className="w-10 text-right text-xs tabular-nums text-white/70">{Math.round(zoom * 100)}%</span>
        </div>
        <Button
          type="button"
          className="w-full rounded-2xl"
          disabled={exporting || !mediaSize}
          onClick={() => void handleExport()}
        >
          {exporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Tayyorlanmoqda…
            </>
          ) : (
            "Shu ko'rinishda saqlash"
          )}
        </Button>
      </footer>
    </div>
  );
}
