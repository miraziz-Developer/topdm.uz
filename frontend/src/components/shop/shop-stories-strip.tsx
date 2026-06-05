"use client";

import { AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { CirclePlay, Sparkles } from "lucide-react";

import { StoryViewerModal } from "@/components/home/story-viewer-modal";
import { getShopStories } from "@/lib/api";
import { buildMockShopStories } from "@/lib/mock-shop-demo";
import { ApiError } from "@/lib/http-client";
import { allowDemoFakeData } from "@/lib/runtime-flags";
import { PLACEHOLDER_IMAGE, resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { LiveStory } from "@/types";

type ShopStoriesStripProps = {
  shopId: string;
  shopName: string;
  shopSlug: string;
  ipadrom?: string | null;
  className?: string;
};

function storyThumbUrl(story: LiveStory): string {
  const raw = story.image_url?.trim();
  return raw ? resolveMediaUrl(raw) : PLACEHOLDER_IMAGE;
}

function formatStoryAge(createdAt: string): string {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return "Story";
  const hours = Math.floor((Date.now() - created) / (1000 * 60 * 60));
  if (hours < 1) return "Yangi";
  if (hours < 24) return `${hours} soat`;
  return "24 soat";
}

export function ShopStoriesStrip({
  shopId,
  shopName,
  shopSlug,
  ipadrom,
  className,
}: ShopStoriesStripProps) {
  const [stories, setStories] = useState<LiveStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getShopStories(shopId)
      .then((res) => {
        if (cancelled) return;
        const items = res.items ?? [];
        if (items.length > 0) {
          setStories(items);
          setIsDemo(false);
          return;
        }
        if (allowDemoFakeData()) {
          setStories(
            buildMockShopStories({ id: shopId, name: shopName, slug: shopSlug, ipadrom }),
          );
          setIsDemo(true);
        } else {
          setStories([]);
          setIsDemo(false);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (allowDemoFakeData()) {
          setStories(
            buildMockShopStories({ id: shopId, name: shopName, slug: shopSlug, ipadrom }),
          );
          setIsDemo(true);
        } else {
          setStories([]);
          setIsDemo(false);
        }
        if (!(err instanceof ApiError && err.status === 404)) {
          /* tarmoq xatosi — demo fallback */
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shopId, shopName, shopSlug, ipadrom]);

  const openAt = useCallback((index: number) => setViewerIndex(index), []);
  const closeViewer = useCallback(() => setViewerIndex(null), []);

  if (loading) {
    return (
      <section className={cn("rounded-2xl border border-border-subtle bg-surface p-4", className)}>
        <div className="skeleton mb-3 h-4 w-32 rounded-md" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-[132px] w-[88px] shrink-0 rounded-2xl" />
          ))}
        </div>
      </section>
    );
  }

  if (!stories.length) return null;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-sm",
        className,
      )}
      aria-label={`${shopName} storylari`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-electric-500/15 to-indigo-500/10 text-electric-600">
            <CirclePlay className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-text-100">Storylar</p>
            <p className="text-xs text-text-400">
              {stories.length} ta jonli — 24 soat ichida
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5">
          {isDemo ? (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Demo
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 rounded-full bg-electric-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-electric-600">
            <Sparkles className="h-3 w-3" aria-hidden />
            Live
          </span>
        </span>
      </div>

      <div
        className="flex gap-3 overflow-x-auto px-4 py-4 scrollbar-hide snap-x snap-mandatory"
        role="list"
      >
        {stories.map((story, index) => (
          <StoryThumb
            key={story.id}
            story={story}
            index={index}
            shopName={shopName}
            onOpen={() => openAt(index)}
          />
        ))}
      </div>

      <AnimatePresence>
        {viewerIndex !== null && stories.length > 0 ? (
          <StoryViewerModal
            stories={stories}
            index={viewerIndex}
            onClose={closeViewer}
            onIndexChange={setViewerIndex}
          />
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function StoryThumb({
  story,
  index,
  shopName,
  onOpen,
}: {
  story: LiveStory;
  index: number;
  shopName: string;
  onOpen: () => void;
}) {
  const [src, setSrc] = useState(() => storyThumbUrl(story));
  const hot = story.is_hot;
  const age = formatStoryAge(story.created_at);

  return (
    <button
      type="button"
      role="listitem"
      onClick={onOpen}
      className="group flex w-[92px] shrink-0 snap-start flex-col items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/50 focus-visible:ring-offset-2"
    >
      <div
        className={cn(
          "relative aspect-[9/16] w-[88px] rounded-2xl p-[2.5px] shadow-md transition-transform duration-200 group-hover:scale-[1.04]",
          hot
            ? "bg-gradient-to-tr from-amber-400 via-rose-500 to-electric-500"
            : "bg-gradient-to-br from-electric-500/60 via-indigo-600/50 to-ink-900/40",
        )}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[14px] bg-ink-900">
          <Image
            src={src}
            alt={`${shopName} story ${index + 1}`}
            fill
            unoptimized
            className="object-cover"
            sizes="88px"
            onError={() => setSrc(PLACEHOLDER_IMAGE)}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
          <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            {age}
          </span>
          {hot ? (
            <span className="absolute left-1.5 top-1.5 rounded bg-rose-500 px-1 py-0.5 text-[8px] font-bold text-white">
              HOT
            </span>
          ) : null}
        </div>
      </div>
      <span className="line-clamp-1 w-full text-center text-[10px] font-semibold text-text-400 group-hover:text-electric-600">
        #{index + 1}
      </span>
    </button>
  );
}
