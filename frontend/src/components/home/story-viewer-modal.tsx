"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, MapPin, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect } from "react";

import { LivePill } from "@/components/ui/live-pill";
import { resolveMediaUrl } from "@/lib/media";
import type { LiveStory } from "@/types";

export type StoryViewerModalProps = {
  stories: LiveStory[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

export function StoryViewerModal({ stories, index, onClose, onIndexChange }: StoryViewerModalProps) {
  const story = stories[index];
  const hasPrev = index > 0;
  const hasNext = index < stories.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onIndexChange(index - 1);
  }, [hasPrev, index, onIndexChange]);

  const goNext = useCallback(() => {
    if (hasNext) onIndexChange(index + 1);
  }, [hasNext, index, onIndexChange]);

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

  if (!story) return null;

  const imageSrc = resolveMediaUrl(story.image_url);
  const shopName = story.shop?.name || "Do'kon";
  const routeHref = story.route_path || (story.shop?.slug ? `/map?shop=${story.shop.slug}` : "/map");

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          key={story.id}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25 }}
          className="relative mx-auto flex h-[100dvh] max-w-lg flex-col"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="min-w-0 flex-1 pr-3 text-white">
              <p className="truncate text-sm font-semibold">{shopName}</p>
              <p className="truncate text-xs text-white/70">{story.level_context}</p>
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

          <div className="relative mx-4 flex-1 overflow-hidden rounded-3xl bg-ink-900 shadow-2xl">
            <Image src={imageSrc} alt={shopName} fill className="object-cover" sizes="(max-width: 512px) 100vw, 512px" priority />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />

            {story.is_hot ? (
              <span className="absolute left-4 top-4">
                <LivePill className="bg-electric-500/20 text-electric-400" />
              </span>
            ) : null}

            <div className="absolute bottom-0 left-0 right-0 p-5">
              <p className="text-lg font-bold text-white">{shopName}</p>
              <p className="mt-1 text-sm text-white/75">{story.level_context}</p>
              {story.shop?.ipadrom ? <p className="mt-0.5 text-xs text-white/55">{story.shop.ipadrom}</p> : null}
            </div>
          </div>

          <footer className="flex items-center justify-between gap-3 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              disabled={!hasPrev}
              onClick={goPrev}
              className="rounded-full bg-white/10 p-2 text-white disabled:opacity-30"
              aria-label="Oldingi"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <Link
              href={routeHref}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-electric px-5 py-3 text-sm font-bold text-white shadow-[0_0_24px_rgba(0,102,255,0.45)] transition hover:brightness-110"
            >
              <MapPin className="h-4 w-4" />
              Do&apos;konga borish (Route)
            </Link>
            <button
              type="button"
              disabled={!hasNext}
              onClick={goNext}
              className="rounded-full bg-white/10 p-2 text-white disabled:opacity-30"
              aria-label="Keyingi"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
