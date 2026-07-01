"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Sparkles, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BozorliiiLogo } from "@/components/brand/bozorliii-logo";
import { SectionHeader } from "@/components/ui/section-header";
import { usePremiumBanners } from "@/hooks/usePremiumBanners";
import { useT } from "@/i18n/locale-provider";
import { trackPremiumBannerClick, trackPremiumBannerImpression } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media";
import { allowDevMocks } from "@/lib/runtime-flags";
import { cn } from "@/lib/utils";
import type { PremiumBannerSlide, PremiumTariffCode } from "@/types/premium-banner";

const SECTION_SHELL = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";
const DEFAULT_INTERVAL = 4500;

const MOCK_SLIDES: PremiumBannerSlide[] = [
  {
    id: "demo-murod-vip",
    shop_id: "demo-1",
    shop_name: "Murod VIP",
    shop_slug: "murod-vip",
    rating: 4.9,
    image_url:
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1200&q=85",
    headline: "Premium kuz kolleksiyasi",
    tariff_code: "gold",
    tariff_label: "Gold VIP",
    priority_weight: 3,
    dwell_ms: 5500,
    frame_style: "gold_neon",
    badge_label: "VIP Gold",
    cta_url: "/search",
    ipadrom: "Ippodrom",
    location_label: "2-yo'lak",
  },
  {
    id: "demo-anor",
    shop_id: "demo-2",
    shop_name: "Anor Boutique",
    shop_slug: "anor-boutique",
    rating: 4.7,
    image_url:
      "https://images.unsplash.com/photo-1434389677669-641f78720c3e?auto=format&fit=crop&w=1200&q=85",
    headline: "Haftalik trendlar",
    tariff_code: "silver",
    tariff_label: "Silver",
    priority_weight: 2,
    dwell_ms: 5000,
    frame_style: "silver_glow",
    badge_label: "Silver",
    cta_url: "/search",
    ipadrom: "Abu Saxiy",
    location_label: "1-Glavniy",
  },
  {
    id: "demo-style",
    shop_id: "demo-3",
    shop_name: "Style House",
    shop_slug: "style-house",
    rating: 4.5,
    image_url:
      "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1200&q=85",
    headline: "Kunlik yangiliklar",
    tariff_code: "bronze",
    tariff_label: "Bronze",
    priority_weight: 1,
    dwell_ms: 4500,
    frame_style: "standard",
    badge_label: null,
    cta_url: "/search",
    ipadrom: "Ippodrom",
    location_label: "5-yo'lak",
  },
];

function frameClass(code: PremiumTariffCode): string {
  switch (code) {
    case "gold":
      return "p-[3px] bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 shadow-[0_0_40px_-8px_rgba(251,191,36,0.65)]";
    case "silver":
      return "p-[2px] bg-gradient-to-br from-slate-200 via-white to-slate-400 shadow-[0_12px_40px_-12px_rgba(148,163,184,0.55)]";
    default:
      return "p-[1px] bg-gradient-to-br from-border-subtle to-elevated";
  }
}

function innerCardClass(code: PremiumTariffCode): string {
  switch (code) {
    case "gold":
      return "ring-1 ring-amber-400/30";
    case "silver":
      return "ring-1 ring-slate-300/50";
    default:
      return "ring-1 ring-border-subtle";
  }
}

type BannerCardProps = {
  slide: PremiumBannerSlide;
  onNavigate: () => void;
};

function BannerCard({ slide, onNavigate }: BannerCardProps) {
  const imageSrc = resolveMediaUrl(slide.image_url);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <Link
      href={slide.cta_url}
      onClick={onNavigate}
      className="group relative block h-full w-full overflow-hidden rounded-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/50"
    >
      {imgFailed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-200 px-6 text-center">
          <BozorliiiLogo variant="icon" size="md" href={null} />
          <p className="mt-3 text-sm font-bold text-ink-900">{slide.shop_name}</p>
          <p className="mt-1 text-xs font-medium text-ink-500">{slide.headline || "Premium do'kon"}</p>
        </div>
      ) : (
        <Image
          src={imageSrc}
          alt={slide.shop_name}
          fill
          priority
          onError={() => setImgFailed(true)}
          className="object-contain bg-ink-900/20 transition duration-700 group-hover:scale-[1.02]"
          sizes="(max-width: 768px) 100vw, 720px"
        />
      )}
      <motion.div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-900/95 via-ink-900/45 to-ink-900/10"
        initial={false}
      />
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex flex-wrap items-end justify-between gap-3"
        >
          <motion.div>
            {slide.badge_label ? (
              <span
                className={cn(
                  "mb-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                  slide.tariff_code === "gold"
                    ? "bg-amber-400/90 text-ink-900"
                    : "bg-white/20 text-white backdrop-blur-md",
                )}
              >
                {slide.tariff_code === "gold" ? <Sparkles className="h-3 w-3" aria-hidden /> : null}
                {slide.badge_label}
              </span>
            ) : null}
            <p className="text-lg font-bold tracking-tight text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.45)] sm:text-xl">
              {slide.shop_name}
            </p>
            <p className="mt-0.5 line-clamp-1 text-sm text-white/90 [text-shadow:0_2px_8px_rgba(0,0,0,0.4)]">
              {slide.headline}
            </p>
            {slide.location_label ? (
              <p className="mt-1 text-[11px] text-white/75">
                {slide.ipadrom} · {slide.location_label}
              </p>
            ) : null}
          </motion.div>
          <motion.div
            className="flex shrink-0 items-center gap-1 rounded-xl bg-white/15 px-3 py-2 backdrop-blur-md"
            whileHover={{ scale: 1.04 }}
          >
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
            <span className="price-mono text-sm font-bold text-white">{slide.rating.toFixed(1)}</span>
          </motion.div>
        </motion.div>
      </div>
    </Link>
  );
}

export function PremiumBannersCarousel() {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const { data, isLoading } = usePremiumBanners();
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const impressedRef = useRef<Set<string>>(new Set());
  const touchStartX = useRef<number | null>(null);

  const slides = useMemo(() => {
    const fromApi = data?.slides?.length ? data.slides : data?.items;
    if (fromApi?.length) return fromApi;
    return allowDevMocks() ? MOCK_SLIDES : [];
  }, [data]);

  const carouselCfg = data?.carousel;
  const intervalMs = carouselCfg?.interval_ms ?? data?.rotation_interval_ms ?? DEFAULT_INTERVAL;
  const slideCount = slides.length;

  const goTo = useCallback(
    (next: number) => {
      if (slideCount < 1) return;
      setActiveIndex(((next % slideCount) + slideCount) % slideCount);
    },
    [slideCount],
  );

  const goNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const goPrev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  useEffect(() => {
    const autoplay = carouselCfg?.autoplay !== false;
    if (reduceMotion || paused || slideCount < 2 || !autoplay) return;
    const id = window.setInterval(goNext, intervalMs);
    return () => window.clearInterval(id);
  }, [carouselCfg?.autoplay, goNext, intervalMs, paused, reduceMotion, slideCount]);

  const activeSlide = slides[activeIndex];

  useEffect(() => {
    if (!activeSlide?.id) return;
    if (impressedRef.current.has(activeSlide.id)) return;
    impressedRef.current.add(activeSlide.id);
    void trackPremiumBannerImpression(activeSlide.id);
  }, [activeSlide?.id]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX ?? start;
    const delta = end - start;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) goNext();
    else goPrev();
  };

  if ((!isLoading && !slides.length) || (!isLoading && carouselCfg?.enabled === false)) {
    return null;
  }

  return (
    <section className={cn(SECTION_SHELL, "py-5 md:py-7")}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeader
          eyebrow={t("home.premiumBanners.eyebrow")}
          title={t("home.premiumBanners.title")}
          description={t("home.premiumBanners.description")}
          descriptionClassName="!mt-2 block text-sm font-medium tracking-wide !text-neutral-500"
          className="mb-0 flex-1"
        />
        <span className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {t("home.premiumBanners.sponsored")}
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative mt-6 overflow-hidden rounded-2xl glass-panel-strong p-2 shadow-elevated ring-1 ring-black/[0.04] sm:p-3"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(251,191,36,0.08),transparent_55%)]" />

        {isLoading ? (
          <div className="skeleton aspect-[16/7] w-full rounded-xl sm:aspect-[21/8]" />
        ) : (
          <div className={cn("relative mx-auto aspect-[16/7] max-h-[320px] w-full sm:aspect-[21/8] sm:max-h-[360px]", frameClass(activeSlide?.tariff_code ?? "bronze"))}>
            <motion.div
              className={cn(
                "relative h-full w-full overflow-hidden rounded-[14px] bg-ink-900",
                innerCardClass(activeSlide?.tariff_code ?? "bronze"),
              )}
            >
              <AnimatePresence mode="wait">
                {activeSlide ? (
                  <motion.div
                    key={`${activeSlide.id}-${activeIndex}`}
                    className="absolute inset-0"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <BannerCard
                      slide={activeSlide}
                      onNavigate={() => void trackPremiumBannerClick(activeSlide.id)}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          </div>
        )}

        {slideCount > 1 ? (
          <>
            <button
              type="button"
              aria-label={t("home.premiumBanners.prev")}
              onClick={goPrev}
              className="absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-ink-900/40 text-white backdrop-blur-md transition hover:bg-ink-900/65 sm:left-5"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label={t("home.premiumBanners.next")}
              onClick={goNext}
              className="absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-ink-900/40 text-white backdrop-blur-md transition hover:bg-ink-900/65 sm:right-5"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={`${s.id}-dot-${i}`}
                  type="button"
                  aria-label={`Slide ${i + 1}`}
                  onClick={() => goTo(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === activeIndex ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70",
                  )}
                />
              ))}
            </div>
          </>
        ) : null}
      </motion.div>
    </section>
  );
}
