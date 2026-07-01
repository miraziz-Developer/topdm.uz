"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import { StoryViewerModal } from "@/components/home/story-viewer-modal";
import { SectionHeader } from "@/components/ui/section-header";
import { useStoryDock } from "@/hooks/useStoryDock";
import { useT } from "@/i18n/locale-provider";
import { PLACEHOLDER_BOUTIQUE, PLACEHOLDER_IMAGE, resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { StoryDockRing } from "@/types";

const SECTION_SHELL = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";
const AUTOPLAY_MS = 4200;
const DOCK_FETCH_LIMIT = 24;
const DOCK_VISIBLE_SLOTS = 5;

/** ~5 ta halqa ekranga sig'ishi uchun o'lcham */
const DOCK_CARD_CLASS =
  "w-[calc((100%-3rem)/5)] min-w-[68px] max-w-[92px] sm:min-w-[76px] sm:max-w-[100px] md:max-w-[108px]";

function StoryDockSkeleton() {
  return (
    <div className={cn("flex shrink-0 snap-start flex-col items-center gap-2", DOCK_CARD_CLASS)}>
      <div className="aspect-square w-full rounded-[22px] shadow-lg skeleton sm:rounded-[26px]" />
      <div className="skeleton h-2.5 w-[85%] rounded-md" />
    </div>
  );
}

type StoryDockCardProps = {
  ring: StoryDockRing;
  index: number;
  liveLabel: string;
  promoLabel: string;
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

function StoryDockCard({ ring, index, liveLabel, promoLabel, onOpen }: StoryDockCardProps) {
  const [imageSrc, setImageSrc] = useState(() => storyThumbFromPreview(ring));
  const storeName = ring.shop?.name || ring.preview_story.shop?.name || "Do'kon";
  const hot = ring.preview_story.is_hot;
  const countBadge = ring.active_count > 1 ? ring.active_count : null;
  const isPromo = Boolean(ring.is_platform_ad);

  useEffect(() => {
    setImageSrc(storyThumbFromPreview(ring));
  }, [ring]);

  return (
    <motion.button
      data-story-dock-item
      type="button"
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      onClick={onOpen}
      className={cn(
        "group flex shrink-0 snap-start cursor-pointer flex-col items-center gap-2 pb-1",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/50 focus-visible:ring-offset-2",
        DOCK_CARD_CLASS,
      )}
    >
      <div
        className={cn(
          "relative aspect-square w-full rounded-[22px] p-[2.5px] shadow-[0_16px_36px_-12px_rgba(8,8,18,0.5)] transition-[transform,box-shadow] duration-300 ease-out will-change-transform sm:rounded-[26px] sm:p-[3px]",
          "group-hover:scale-[1.04] group-hover:shadow-[0_20px_44px_-10px_rgba(0,102,255,0.35)]",
          isPromo
            ? "bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500"
            : hot
              ? "bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-700"
              : "bg-gradient-to-br from-ink-900/40 via-electric-500/25 to-indigo-700/50",
        )}
      >
        {countBadge ? (
          <span className="absolute -right-0.5 -top-0.5 z-10 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-electric-500 px-1 text-[9px] font-bold text-white shadow-md ring-2 ring-white sm:h-5 sm:min-w-[1.25rem] sm:text-[10px]">
            {countBadge}
          </span>
        ) : null}
        <div className="relative h-full w-full overflow-hidden rounded-[20px] bg-white p-[2px] sm:rounded-[23px]">
          <div className="relative h-full w-full overflow-hidden rounded-[18px] bg-elevated sm:rounded-[21px]">
            <Image
              src={imageSrc}
              alt={storeName}
              fill
              unoptimized
              className="object-cover brightness-[1.04] contrast-[1.03] saturate-[1.1]"
              sizes="96px"
              onError={() => setImageSrc(PLACEHOLDER_IMAGE)}
            />
            <div className="pointer-events-none absolute inset-0 rounded-[18px] bg-gradient-to-b from-black/[0.12] via-transparent to-black/[0.55] sm:rounded-[21px]" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 rounded-b-[18px] bg-gradient-to-t from-black/88 via-black/45 to-transparent px-1 pb-1.5 pt-5 sm:gap-1 sm:rounded-b-[21px] sm:px-2 sm:pb-2 sm:pt-6">
              <Sparkles
                className={cn(
                  "h-2.5 w-2.5 shrink-0 drop-shadow sm:h-3 sm:w-3",
                  isPromo ? "text-amber-300" : hot ? "text-amber-400" : "text-electric-300",
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "text-[7px] font-extrabold uppercase tracking-[0.14em] text-white drop-shadow-md sm:text-[8px] sm:tracking-[0.16em]",
                  hot && !isPromo && "motion-safe:animate-pulse",
                )}
              >
                {isPromo ? promoLabel : liveLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
      <span className="line-clamp-2 w-full px-0.5 text-center text-[9px] font-extrabold leading-tight tracking-tight text-ink-900 transition-colors group-hover:text-electric-600 sm:text-[10px] sm:leading-snug">
        {storeName}
      </span>
    </motion.button>
  );
}

export function StoriesFeed() {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const { data, isLoading } = useStoryDock(DOCK_FETCH_LIMIT);

  const rings = useMemo<StoryDockRing[]>(() => data?.items ?? [], [data?.items]);

  const [viewerRingIndex, setViewerRingIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dockHover, setDockHover] = useState(false);

  const advanceScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || rings.length < 2) return;
    const first = el.querySelector("[data-story-dock-item]") as HTMLElement | null;
    if (!first) return;
    const gapRaw = getComputedStyle(el).gap || getComputedStyle(el).columnGap || "12px";
    const gap = Number.parseFloat(gapRaw) || 12;
    const step = first.getBoundingClientRect().width + gap;
    const max = el.scrollWidth - el.clientWidth - 2;
    let next = el.scrollLeft + step;
    if (next >= max) next = 0;
    el.scrollTo({ left: next, behavior: "smooth" });
  }, [rings.length]);

  useEffect(() => {
    if (reduceMotion || dockHover || viewerRingIndex !== null || rings.length < 2) return;
    const id = window.setInterval(advanceScroll, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [advanceScroll, dockHover, reduceMotion, rings.length, viewerRingIndex]);

  if (!isLoading && rings.length === 0) {
    return null;
  }

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
        className="relative mt-5 overflow-hidden rounded-[1.35rem] border border-border-subtle/90 bg-white/80 shadow-elevated ring-1 ring-black/[0.04] backdrop-blur-xl"
        onMouseEnter={() => setDockHover(true)}
        onMouseLeave={() => setDockHover(false)}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_10%_-20%,rgba(0,102,255,0.12),transparent_50%),radial-gradient(ellipse_80%_60%_at_100%_100%,rgba(255,77,18,0.06),transparent_45%)]" />
        <p className="pointer-events-none absolute left-4 top-3 z-[2] flex items-center gap-1 rounded-full border border-electric-500/15 bg-white/70 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-electric-600 shadow-sm backdrop-blur-sm sm:hidden">
          <Sparkles className="h-3 w-3" aria-hidden />
          {t("home.stories.wowwDock")}
        </p>
        <div className="pointer-events-none absolute inset-y-3 left-0 z-[1] w-6 bg-gradient-to-r from-white/95 to-transparent md:w-10" />
        <div className="pointer-events-none absolute inset-y-3 right-0 z-[1] w-6 bg-gradient-to-l from-white/95 to-transparent md:w-10" />

        <div
          ref={scrollRef}
          className={cn(
            "relative flex items-start gap-3 overflow-x-auto px-3 py-4 sm:gap-4 sm:px-5 sm:py-5",
            "scrollbar-hide snap-x snap-mandatory scroll-smooth",
          )}
          role="list"
          aria-label={t("home.stories.title")}
        >
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <StoryDockSkeleton key={index} />
            ))
          ) : (
            rings.map((ring, index) => (
              <StoryDockCard
                key={`${ring.shop_id}-${ring.preview_story.id}`}
                ring={ring}
                index={index}
                liveLabel={t("home.stories.liveBadge")}
                promoLabel={t("home.stories.promoBadge")}
                onOpen={() => setViewerRingIndex(index)}
              />
            ))
          )}
        </div>

        {!reduceMotion && rings.length > 5 ? (
          <div
            className="pointer-events-none absolute bottom-0 left-1/2 h-0.5 w-1/3 max-w-xs -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-electric-500/35 to-transparent motion-safe:animate-pulse"
            aria-hidden
          />
        ) : null}
      </motion.div>

      {rings.length > 5 ? (
        <p className="mt-2 text-center text-[11px] text-ink-400">
          {t("home.stories.scrollHint")}
        </p>
      ) : null}

      <AnimatePresence>
        {viewerRingIndex !== null && rings.length > 0 ? (
          <StoryViewerModal
            rings={rings}
            initialRingIndex={viewerRingIndex}
            onClose={() => setViewerRingIndex(null)}
          />
        ) : null}
      </AnimatePresence>
    </section>
  );
}
