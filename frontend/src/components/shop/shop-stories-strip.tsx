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
import {
  shopCardShell,
  shopSectionSubtitle,
  shopSectionTitle,
  shopTypeChip,
} from "@/components/shop/shop-premium-ui";
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
      className={cn(shopCardShell, className)}
      aria-label={`${shopName} storylari`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-black/[0.05] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#f0eeea] text-ink-700 ring-1 ring-black/[0.04]">
            <CirclePlay className="h-4 w-4" />
          </span>
          <div>
            <p className={shopSectionTitle}>Storylar</p>
            <p className={shopSectionSubtitle}>
              {stories.length} ta · 24 soat faol
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5">
          {isDemo ? (
            <span className={cn(shopTypeChip, "bg-amber-50 text-amber-800 ring-amber-200/60")}>
              Demo
            </span>
          ) : null}
          <span className={cn(shopTypeChip, "bg-[#eef4ff] text-[#1d4ed8] ring-[#bfdbfe]/60")}>
            <Sparkles className="mr-1 inline h-3 w-3" aria-hidden />
            Live
          </span>
        </span>
      </div>

      <div
        className="flex gap-4 overflow-x-auto px-4 py-5 scrollbar-hide snap-x snap-mandatory"
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
            rings={[
              {
                shop_id: shopId,
                shop: stories[0]?.shop ?? {
                  id: shopId,
                  name: shopName,
                  ipadrom: ipadrom || "Bozor",
                  floor: "",
                  slug: shopSlug,
                },
                preview_story: stories[viewerIndex] ?? stories[0],
                active_count: stories.length,
              },
            ]}
            initialRingIndex={0}
            initialStoryIndex={viewerIndex}
            onClose={closeViewer}
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
      className="group flex w-[76px] shrink-0 snap-start flex-col items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/50 focus-visible:ring-offset-2"
    >
      <div
        className={cn(
          "relative rounded-full p-[2.5px] shadow-md transition-transform duration-200 group-hover:scale-[1.05]",
          hot
            ? "bg-gradient-to-tr from-amber-400 via-rose-500 to-electric-500"
            : "bg-gradient-to-br from-electric-500 via-indigo-500 to-rose-400",
        )}
      >
        <div className="relative h-[68px] w-[68px] overflow-hidden rounded-full bg-ink-900 ring-2 ring-surface">
          <Image
            src={src}
            alt={`${shopName} story ${index + 1}`}
            fill
            unoptimized
            className="object-cover"
            sizes="68px"
            onError={() => setSrc(PLACEHOLDER_IMAGE)}
          />
          {hot ? (
            <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white ring-2 ring-surface">
              !
            </span>
          ) : null}
        </div>
      </div>
      <span className="line-clamp-1 w-full text-center text-[11px] font-medium tracking-wide text-text-400 group-hover:text-ink-700">
        {age}
      </span>
    </button>
  );
}
