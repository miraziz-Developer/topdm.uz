"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import { StoryViewerModal } from "@/components/home/story-viewer-modal";
import { SectionHeader } from "@/components/ui/section-header";
import { useLiveStories } from "@/hooks/useLiveStories";
import { useT } from "@/i18n/locale-provider";
import { mockStoriesAsLive } from "@/lib/mock-stories";
import { allowDevMocks } from "@/lib/runtime-flags";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { LiveStory } from "@/types";

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
  story: LiveStory;
  index: number;
  liveLabel: string;
  onOpen: () => void;
};

function StoryDockCard({ story, index, liveLabel, onOpen }: StoryDockCardProps) {
  const imageSrc = resolveMediaUrl(story.image_url);
  const storeName = story.shop?.name || story.level_context || "Do'kon";
  const hot = story.is_hot;

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
        <div className="relative h-full w-full overflow-hidden rounded-[27px] bg-white p-[2px]">
          <div className="relative h-full w-full overflow-hidden rounded-[25px] bg-elevated">
            <Image
              src={imageSrc}
              alt={storeName}
              fill
              className="object-cover brightness-[1.04] contrast-[1.03] saturate-[1.1]"
              sizes="120px"
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
  const { data, isLoading } = useLiveStories();
  const apiStories = data?.items ?? [];
  const stories = useMemo<LiveStory[]>(() => {
    if (apiStories.length > 0) return apiStories;
    return allowDevMocks() ? mockStoriesAsLive() : [];
  }, [apiStories]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dockHover, setDockHover] = useState(false);

  const advanceScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || stories.length < 2) return;
    const first = el.querySelector("[data-story-dock-item]") as HTMLElement | null;
    if (!first) return;
    const gapRaw = getComputedStyle(el).gap || getComputedStyle(el).columnGap || "20px";
    const gap = Number.parseFloat(gapRaw) || 20;
    const step = first.getBoundingClientRect().width + gap;
    const max = el.scrollWidth - el.clientWidth - 2;
    let next = el.scrollLeft + step;
    if (next >= max) next = 0;
    el.scrollTo({ left: next, behavior: "smooth" });
  }, [stories.length]);

  useEffect(() => {
    if (reduceMotion || dockHover || viewerIndex !== null || stories.length < 2) return;
    const id = window.setInterval(advanceScroll, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [advanceScroll, dockHover, reduceMotion, stories.length, viewerIndex]);

  if (!isLoading && stories.length === 0) {
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
        className={cn(
          "relative mt-6 overflow-hidden rounded-[1.35rem]",
          "border border-border-subtle/90 bg-white/55 shadow-elevated backdrop-blur-xl",
          "ring-1 ring-black/[0.04]",
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
            "relative flex items-stretch gap-5 overflow-x-auto px-4 py-5 md:gap-6 md:px-6 md:py-6",
            "scrollbar-hide snap-x snap-mandatory scroll-smooth",
          )}
          role="list"
          aria-label={t("home.stories.title")}
        >
          {isLoading
            ? Array.from({ length: 6 }).map((_, index) => <StoryDockSkeleton key={index} />)
            : stories.map((story, index) => (
                <StoryDockCard
                  key={story.id}
                  story={story}
                  index={index}
                  liveLabel={t("home.stories.liveBadge")}
                  onOpen={() => setViewerIndex(index)}
                />
              ))}
        </div>

        {!reduceMotion ? (
          <div
            className="pointer-events-none absolute bottom-0 left-1/2 h-0.5 w-1/3 max-w-xs -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-electric-500/35 to-transparent motion-safe:animate-pulse"
            aria-hidden
          />
        ) : null}
      </motion.div>

      <AnimatePresence>
        {viewerIndex !== null && stories.length > 0 ? (
          <StoryViewerModal
            stories={stories}
            index={viewerIndex}
            onClose={() => setViewerIndex(null)}
            onIndexChange={setViewerIndex}
          />
        ) : null}
      </AnimatePresence>
    </section>
  );
}
