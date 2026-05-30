"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Play, Star } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";

import { SectionHeader } from "@/components/ui/section-header";
import { allowDevMocks } from "@/lib/runtime-flags";
import { cn } from "@/lib/utils";

const RENDER_STARS = (rating: number) =>
  Array.from({ length: 5 }).map((_, idx) => (
    <Star
      key={idx}
      className={cn(
        "h-4 w-4",
        idx < rating ? "fill-electric-500 text-electric-500" : "text-ink-300/50",
      )}
    />
  ));

type ReviewMedia = {
  id: string;
  type: "image" | "video";
  src: string;
  poster?: string;
  caption: string;
  author: string;
  district: string;
  rating: number;
};

const REVIEW_MEDIA: ReviewMedia[] = [
  {
    id: "r1",
    type: "image",
    src: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=900&q=80",
    caption: "Yunusobod blokida o'lcham aynan mos keldi, sotuvchi 5 daqiqada qayta tikdi.",
    author: "Dilnoza K.",
    district: "Yunusobod",
    rating: 5,
  },
  {
    id: "r2",
    type: "video",
    src: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    poster: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80",
    caption: "Chorsu 1-qavat: kurtka matosi yengil, kechki salqin havoda ham qulay.",
    author: "Jasur T.",
    district: "Chorsu",
    rating: 5,
  },
  {
    id: "r3",
    type: "image",
    src: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80",
    caption: "Do'stim bilan guruh chegirmasida oldik, yetkazib berish 40 daqiqada bo'ldi.",
    author: "Madina S.",
    district: "Olmazor",
    rating: 4,
  },
  {
    id: "r4",
    type: "image",
    src: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=900&q=80",
    caption: "Rang fotosuratdagidek chiqdi, qadoqlash premium darajada edi.",
    author: "Azizbek R.",
    district: "Sergeli",
    rating: 5,
  },
];

type InteractiveReviewsProps = {
  productName: string;
};

export function InteractiveReviews({ productName }: InteractiveReviewsProps) {
  const [activeId, setActiveId] = useState(REVIEW_MEDIA[0].id);
  const active = useMemo(() => REVIEW_MEDIA.find((item) => item.id === activeId) ?? REVIEW_MEDIA[0], [activeId]);

  if (!allowDevMocks()) {
    return null;
  }

  return (
    <section>
      <SectionHeader
        eyebrow="Haqiqiy xaridorlar"
        title="Interaktiv sharhlar"
        description={`${productName} bo'yicha bozordan olingan real foto va video izohlar.`}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="relative overflow-hidden rounded-3xl border border-border-subtle bg-surface">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.35 }}
              className="relative aspect-[4/3] bg-elevated"
            >
              {active.type === "video" ? (
                <video src={active.src} poster={active.poster} controls playsInline className="h-full w-full object-cover" />
              ) : (
                <Image src={active.src} alt={active.caption} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 60vw" />
              )}
            </motion.div>
          </AnimatePresence>
          <div className="border-t border-border-subtle p-5">
            <div className="mb-2 flex items-center gap-1 text-electric-500" aria-label={`Reyting: ${active.rating} yulduz`}>
              {Array.from({ length: 5 }).map((_, index) => (
                <Star
                  key={index}
                  className={cn("h-4 w-4", index < active.rating ? "fill-current" : "text-text-400/40")}
                />
              ))}
              <span className="ml-1 text-xs font-semibold text-text-300">{active.rating}.0</span>
            </div>
            <p className="text-base text-text-100">{active.caption}</p>
            <p className="mt-2 text-sm text-text-400">
              {active.author} • {active.district}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {REVIEW_MEDIA.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveId(item.id)}
              className={cn(
                "group relative overflow-hidden rounded-2xl border text-left transition",
                activeId === item.id ? "border-gold-500 shadow-gold" : "border-border-subtle hover:border-gold-500/40",
              )}
            >
              <div className="relative aspect-square bg-elevated">
                <Image
                  src={item.type === "video" ? item.poster || item.src : item.src}
                  alt={item.author}
                  fill
                  className="object-cover"
                  sizes="180px"
                />
                {item.type === "video" ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-canvas/30">
                    <Play className="h-8 w-8 text-text-100" />
                  </span>
                ) : null}
              </div>
              <div className="p-2">
                <p className="line-clamp-2 text-xs text-text-300">{item.caption}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
