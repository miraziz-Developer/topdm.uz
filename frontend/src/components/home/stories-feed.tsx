"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import { StoryViewerModal } from "@/components/home/story-viewer-modal";
import { SectionHeader } from "@/components/ui/section-header";
import { useStoryDock } from "@/hooks/useStoryDock";
import { useT } from "@/i18n/locale-provider";
import { getShopStories } from "@/lib/api";
import { mockStoriesAsLive } from "@/lib/mock-stories";
import { allowDevMocks } from "@/lib/runtime-flags";
import { PLACEHOLDER_BOUTIQUE, PLACEHOLDER_IMAGE, resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { LiveStory, StoryDockRing } from "@/types";

const SECTION_SHELL = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";
const AUTOPLAY_MS = 4200;

function StoryDockSkeleton() {
  return (
    <div className="flex w-[122px] shrink-0 snap-start flex-col items-center gap-2.5">
      <div className="skeleton h-[118px] w-[118px] rounded-[30px] shadow-lg" />
      <div className="skeleton h-3 w-20 rounded-md" />
    </div>
  );
}

type StoryDockCardProps = {
  ring: StoryDockRing;
  index: number;
  liveLabel: string;
  onOpen: () => void;
};

function storyThumbFromPreview(ring: StoryDockRing): string {
  const story = ring.preview_story;
  const logo = story.shop?.logo_url?.trim() || ring.shop?.logo_url?.trim();
  if (logo) return resolveMediaUrl(logo);
  const cover = story.image_url?.trim();
  if (cover) return resolveMediaUrl(cover);
  return PLACEHOLDER_BOUTIQUE;
}

function StoryDockCard({ ring, index, liveLabel, onOpen }: StoryDockCardProps) {
  const [imageSrc, setImageSrc] = useState(() => storyThumbFromPreview(ring));
  const storeName = ring.shop?.name || ring.preview_story.shop?.name || "Do'kon";
  const hot = ring.preview_story.is_hot;
  const countBadge = ring.active_count > 1 ? ring.active_count : null;

  useEffect(() => {
    setImageSrc(storyThumbFromPreview(ring));
  }, [ring]);

  return (
    <motion.button
      data-story-dock-item
      type="button"
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      onClick={onOpen}
      className="group flex w-[122px] shrink-0 snap-start cursor-pointer flex-col items-center gap-2.5 pb-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/50 focus-visible:ring-offset-2"
    >
      <div
        className={cn(
          "relative h-[118px] w-[118px] rounded-[30px] p-[3px] shadow-[0_20px_44px_-14px_rgba(8,8,18,0.55)] transition-[transform,box-shadow] duration-300 ease-out will-change-transform",
          "group-hover:scale-[1.035] group-hover:shadow-[0_24px_52px_-12px_rgba(0,102,255,0.38)]",
          hot
            ? "bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-700"
            : "bg-gradient-to-br from-ink-900/40 via-electric-500/25 to-indigo-700/50",
        )}
      >
        {countBadge ? (
          <span className="absolute -right-0.5 -top-0.5 z-10 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-electric-500 px-1 text-[10px] font-bold text-white shadow-md ring-2 ring-white">
            {countBadge}
          </span>
        ) : null}
        <div className="relative h-full w-full overflow-hidden rounded-[27px] bg-white p-[2px]">
          <div className="relative h-full w-full overflow-hidden rounded-[25px] bg-elevated">
            <Image
              src={imageSrc}
              alt={storeName}
              fill
              unoptimized
              className="object-cover brightness-[1.04] contrast-[1.03] saturate-[1.1]"
              sizes="120px"
              onError={() => setImageSrc(PLACEHOLDER_IMAGE)}
            />
            <div className="pointer-events-none absolute inset-0 rounded-[25px] bg-gradient-to-b from-black/[0.12] via-transparent to-black/[0.55]" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 rounded-b-[25px] bg-gradient-to-t from-black/88 via-black/45 to-transparent px-2 pb-2 pt-7">
              <Sparkles
                className={cn("h-3 w-3 shrink-0 drop-shadow", hot ? "text-amber-400" : "text-electric-300")}
                aria-hidden
              />
              <span
                className={cn(
                  "text-[9px] font-extrabold uppercase tracking-[0.18em] text-white drop-shadow-md",
                  hot && "motion-safe:animate-pulse",
                )}
              >
                {liveLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
      <span className="line-clamp-2 min-h-[2.5rem] w-full px-0.5 text-center text-[10px] font-extrabold leading-snug tracking-tight text-ink-900 transition-colors group-hover:text-electric-600">
        {storeName}
      </span>
    </motion.button>
  );
}

export function StoriesFeed() {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const { data, isLoading } = useStoryDock(15);
  const apiRings = data?.items ?? [];
  const rings = useMemo<StoryDockRing[]>(() => {
    if (apiRings.length > 0) return apiRings;
    if (!allowDevMocks()) return [];
    const mocks = mockStoriesAsLive();
    return mocks.slice(0, 6).map((s) => ({
      shop_id: s.shop_id,
      shop: s.shop,
      preview_story: s,
      active_count: 1,
    }));
  }, [apiRings]);

  const [viewerStories, setViewerStories] = useState<LiveStory[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [loadingShop, setLoadingShop] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dockHover, setDockHover] = useState(false);

  const openShop = useCallback(async (ring: StoryDockRing) => {
    setLoadingShop(true);
    try {
      const res = await getShopStories(ring.shop_id);
      if (!res.items.length) return;
      setViewerStories(res.items);
      setViewerIndex(0);
    } catch {
      setViewerStories([ring.preview_story]);
      setViewerIndex(0);
    } finally {
      setLoadingShop(false);
    }
  }, []);

  const advanceScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || rings.length < 2) return;
    const first = el.querySelector("[data-story-dock-item]") as HTMLElement | null;
    if (!first) return;
    const gapRaw = getComputedStyle(el).gap || getComputedStyle(el).columnGap || "20px";
    const gap = Number.parseFloat(gapRaw) || 20;
    const step = first.getBoundingClientRect().width + gap;
    const max = el.scrollWidth - el.clientWidth - 2;
    let next = el.scrollLeft + step;
    if (next >= max) next = 0;
    el.scrollTo({ left: next, behavior: "smooth" });
  }, [rings.length]);

  useEffect(() => {
    if (reduceMotion || dockHover || viewerIndex !== null || rings.length < 2) return;
    const id = window.setInterval(advanceScroll, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [advanceScroll, dockHover, reduceMotion, rings.length, viewerIndex]);

  return (
    <section className={cn(SECTION_SHELL, "py-4 md:py-6")}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeader
          eyebrow={t("home.stories.eyebrow")}
          title={t("home.stories.title")}
          description={t("home.stories.description")}
          descriptionClassName="!mt-2 block text-sm font-medium tracking-wide !text-neutral-500"
          className="mb-0 flex-1"
        />
        <motion.p
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-1 hidden items-center gap-1.5 rounded-full border border-electric-500/20 bg-electric-500/8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-electric-600 shadow-sm sm:flex"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {t("home.stories.wowwDock")}
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "relative mt-5 overflow-hidden rounded-[1.35rem]",
          "border border-border-subtle/90 bg-white/80 shadow-elevated backdrop-blur-xl",
          "ring-1 ring-black/[0.04]",
          loadingShop && "pointer-events-none opacity-90",
        )}
        onMouseEnter={() => setDockHover(true)}
        onMouseLeave={() => setDockHover(false)}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_10%_-20%,rgba(0,102,255,0.12),transparent_50%),radial-gradient(ellipse_80%_60%_at_100%_100%,rgba(255,77,18,0.06),transparent_45%)]" />
        <p className="pointer-events-none absolute left-4 top-3 z-[2] flex items-center gap-1 rounded-full border border-electric-500/15 bg-white/70 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-electric-600 shadow-sm backdrop-blur-sm sm:hidden">
          <Sparkles className="h-3 w-3" aria-hidden />
          {t("home.stories.wowwDock")}
        </p>
        <div className="pointer-events-none absolute inset-y-3 left-0 z-[1] w-8 bg-gradient-to-r from-[var(--bg-canvas)] via-[var(--bg-canvas)]/80 to-transparent md:w-12" />
        <div className="pointer-events-none absolute inset-y-3 right-0 z-[1] w-8 bg-gradient-to-l from-[var(--bg-canvas)] via-[var(--bg-canvas)]/80 to-transparent md:w-12" />

        <div
          ref={scrollRef}
          className={cn(
            "relative flex items-start gap-5 overflow-x-auto px-4 py-4 md:gap-6 md:px-6 md:py-5",
            "scrollbar-hide snap-x snap-mandatory scroll-smooth",
          )}
          role="list"
          aria-label={t("home.stories.title")}
        >
          {isLoading ? (
            Array.from({ length: 6 }).map((_, index) => <StoryDockSkeleton key={index} />)
          ) : rings.length === 0 ? (
            <p className="flex min-h-[118px] w-full items-center justify-center px-6 text-center text-sm text-ink-500">
              {t("home.stories.empty")}
            </p>
          ) : (
            rings.map((ring, index) => (
              <StoryDockCard
                key={ring.shop_id}
                ring={ring}
                index={index}
                liveLabel={t("home.stories.liveBadge")}
                onOpen={() => void openShop(ring)}
              />
            ))
          )}
        </div>

        {!reduceMotion ? (
          <div
            className="pointer-events-none absolute bottom-0 left-1/2 h-0.5 w-1/3 max-w-xs -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-electric-500/35 to-transparent motion-safe:animate-pulse"
            aria-hidden
          />
        ) : null}
      </motion.div>

      <AnimatePresence>
        {viewerIndex !== null && viewerStories.length > 0 ? (
          <StoryViewerModal
            stories={viewerStories}
            index={viewerIndex}
            onClose={() => {
              setViewerIndex(null);
              setViewerStories([]);
            }}
            onIndexChange={setViewerIndex}
          />
        ) : null}
      </AnimatePresence>
    </section>
  );
}
