"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, MapPin, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { LivePill } from "@/components/ui/live-pill";
import { getShopStories } from "@/lib/api";
import { isPlatformAdRing } from "@/lib/platform-story-ads";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { LiveStory, StoryDockRing } from "@/types";

const STORY_MS = 5200;
const SWIPE_THRESHOLD = 48;

export type StoryViewerModalProps = {
  rings: StoryDockRing[];
  initialRingIndex: number;
  initialStoryIndex?: number;
  onClose: () => void;
};

async function loadRingStories(ring: StoryDockRing): Promise<LiveStory[]> {
  if (isPlatformAdRing(ring)) return [ring.preview_story];
  try {
    const res = await getShopStories(ring.shop_id);
    if (res.items.length > 0) return res.items;
  } catch {
    /* fallback */
  }
  return [ring.preview_story];
}

export function StoryViewerModal({
  rings,
  initialRingIndex,
  initialStoryIndex = 0,
  onClose,
}: StoryViewerModalProps) {
  const [ringIndex, setRingIndex] = useState(initialRingIndex);
  const [storyIndex, setStoryIndex] = useState(initialStoryIndex);
  const [stories, setStories] = useState<LiveStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const progressRef = useRef(0);

  const ring = rings[ringIndex];
  const story = stories[storyIndex];
  const hasPrevStory = storyIndex > 0;
  const hasNextStory = storyIndex < stories.length - 1;
  const hasPrevRing = ringIndex > 0;
  const hasNextRing = ringIndex < rings.length - 1;

  useEffect(() => {
    let cancelled = false;
    if (!ring) return;
    setLoading(true);
    void loadRingStories(ring).then((items) => {
      if (cancelled) return;
      setStories(items);
      const start = ringIndex === initialRingIndex ? Math.min(initialStoryIndex, items.length - 1) : 0;
      setStoryIndex(Math.max(0, start));
      setProgress(0);
      progressRef.current = 0;
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ring, ringIndex, initialRingIndex, initialStoryIndex]);

  const goPrev = useCallback(() => {
    if (hasPrevStory) {
      setStoryIndex((i) => i - 1);
      setProgress(0);
      progressRef.current = 0;
      return;
    }
    if (!hasPrevRing) return;
    setRingIndex((i) => i - 1);
    setStoryIndex(0);
    setProgress(0);
    progressRef.current = 0;
  }, [hasPrevRing, hasPrevStory]);

  const goNext = useCallback(() => {
    if (hasNextStory) {
      setStoryIndex((i) => i + 1);
      setProgress(0);
      progressRef.current = 0;
      return;
    }
    if (!hasNextRing) {
      onClose();
      return;
    }
    setRingIndex((i) => i + 1);
    setStoryIndex(0);
    setProgress(0);
    progressRef.current = 0;
  }, [hasNextRing, hasNextStory, onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (loading || paused || !story) return;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - started + progressRef.current * STORY_MS;
      const pct = Math.min(1, elapsed / STORY_MS);
      setProgress(pct);
      if (pct >= 1) {
        goNext();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [goNext, loading, paused, ringIndex, story?.id, storyIndex]);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchStart.current = { x: t.clientX, y: t.clientY };
    setPaused(true);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    setPaused(false);
    if (!start) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  const onTapZone = (side: "left" | "right") => {
    if (side === "left") goPrev();
    else goNext();
  };

  if (!ring || !story) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    );
  }

  const imageSrc = resolveMediaUrl(story.image_url);
  const shopName = story.shop?.name || "Do'kon";
  const routeHref = story.route_path || (story.shop?.slug ? `/map?shop=${story.shop.slug}` : "/map");
  const platformAd = isPlatformAdRing(ring);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-black"
        onClick={onClose}
      >
        <motion.div
          key={`${ring.shop_id}-${story.id}`}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.22 }}
          className="relative mx-auto flex h-[100dvh] max-w-lg flex-col"
          onClick={(event) => event.stopPropagation()}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onMouseDown={() => setPaused(true)}
          onMouseUp={() => setPaused(false)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="flex gap-1 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
            {stories.map((s, i) => (
              <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25">
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-75 ease-linear"
                  style={{
                    width:
                      i < storyIndex ? "100%" : i === storyIndex ? `${progress * 100}%` : "0%",
                  }}
                />
              </div>
            ))}
          </div>

          <header className="flex items-center justify-between px-4 pb-2">
            <div className="min-w-0 flex-1 pr-3 text-white">
              <p className="truncate text-sm font-semibold">{shopName}</p>
              <p className="truncate text-xs text-white/70">
                {platformAd ? "Bozorliii reklama" : story.level_context}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              aria-label="Yopish"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="relative mx-3 flex-1 overflow-hidden rounded-3xl bg-ink-900 shadow-2xl sm:mx-4">
            <button
              type="button"
              className="absolute inset-y-0 left-0 z-20 w-[30%]"
              aria-label="Oldingi"
              onClick={() => onTapZone("left")}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 z-20 w-[70%]"
              aria-label="Keyingi"
              onClick={() => onTapZone("right")}
            />

            <Image
              src={imageSrc}
              alt={shopName}
              fill
              className="object-cover"
              sizes="(max-width: 512px) 100vw, 512px"
              priority
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />

            {story.is_hot ? (
              <span className="pointer-events-none absolute left-4 top-4">
                <LivePill className="bg-electric-500/20 text-electric-400" />
              </span>
            ) : null}

            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              </div>
            ) : null}

            <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-5">
              <p className="text-lg font-bold text-white">{shopName}</p>
              <p className="mt-1 text-sm text-white/75">{story.level_context}</p>
              {story.shop?.ipadrom ? (
                <p className="mt-0.5 text-xs text-white/55">{story.shop.ipadrom}</p>
              ) : null}
            </div>
          </div>

          <footer className="flex items-center justify-between gap-3 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              disabled={!hasPrevStory && !hasPrevRing}
              onClick={goPrev}
              className="rounded-full bg-white/10 p-2 text-white disabled:opacity-30"
              aria-label="Oldingi"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <Link
              href={routeHref}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-[0_0_24px_rgba(0,102,255,0.45)] transition hover:brightness-110",
                platformAd ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-electric",
              )}
            >
              <MapPin className="h-4 w-4" />
              {platformAd ? "Batafsil ko'rish" : "Do'konga borish"}
            </Link>
            <button
              type="button"
              disabled={!hasNextStory && !hasNextRing}
              onClick={goNext}
              className="rounded-full bg-white/10 p-2 text-white disabled:opacity-30"
              aria-label="Keyingi"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </footer>

          <p className="pb-[max(0.25rem,env(safe-area-inset-bottom))] text-center text-[10px] font-medium uppercase tracking-[0.2em] text-white/35">
            {ringIndex + 1} / {rings.length}
            {stories.length > 1 ? ` · ${storyIndex + 1}/${stories.length}` : ""}
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
