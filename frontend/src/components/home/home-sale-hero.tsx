"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Film,
  Flame,
  MapPin,
  QrCode,
  Search,
  Shirt,
  ShoppingBag,
  Store,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BozorliiiLogo } from "@/components/brand/bozorliii-logo";
import { BRAND } from "@/components/brand/brand-tokens";
import { useFeaturedProducts } from "@/hooks/useFeaturedProducts";
import { productImage } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

const ROTATING_WORDS = ["kiyim", "poyabzal", "aksesuar", "sumka", "elektronika"] as const;

const PROOF_CHIPS = [
  { icon: Zap, label: "2 daqiqada bron" },
  { icon: QrCode, label: "QR bilan olib ketish" },
  { icon: MapPin, label: "Rasta xaritasi" },
] as const;

const FEATURE_LINKS = [
  { icon: MapPin, label: "Xarita", hint: "Rastani toping", href: "/map", color: "hover:shadow-[0_0_28px_rgba(56,189,248,0.45)]" },
  { icon: Film, label: "Reels", hint: "Do'kon videolari", href: "/reels", color: "hover:shadow-[0_0_28px_rgba(251,191,36,0.45)]" },
  { icon: Store, label: "Story", hint: "Jonli vitrina", href: "#stories", color: "hover:shadow-[0_0_28px_rgba(244,114,182,0.45)]" },
  { icon: Search, label: "AI qidiruv", hint: "Rasm yoki matn", href: "/search", color: "hover:shadow-[0_0_28px_rgba(129,140,248,0.45)]" },
] as const;

const MARQUEE_ITEMS = [
  "Ippodrom bozori",
  "Abu Saxiy",
  "QR olib ketish",
  "Jonli story",
  "AI stylist",
  "Do'kon chat",
  "Tezkor bron",
  "Rasta xaritasi",
] as const;

/** Pastki ticker — oddiy nuqta, bayram yulduzchasisiz */
function MarqueeSeparator() {
  return <span className="inline-block h-1 w-1 rounded-full bg-white/35" aria-hidden />;
}

const FLOAT_OFFSETS = [
  { x: "-8%", y: "6%", rotate: -8, delay: 0 },
  { x: "58%", y: "-4%", rotate: 6, delay: 0.15 },
  { x: "72%", y: "42%", rotate: 10, delay: 0.3 },
  { x: "4%", y: "48%", rotate: -5, delay: 0.45 },
] as const;

function formatUzs(n: number): string {
  return `${n.toLocaleString("uz-UZ")} so'm`;
}

function scrollToStories() {
  document.querySelector('[data-section="stories"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function FloatingProductCard({
  product,
  offset,
  index,
}: {
  product: Product;
  offset: (typeof FLOAT_OFFSETS)[number];
  index: number;
}) {
  const img = productImage(product.images);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute w-[38%] min-w-[108px] max-w-[148px]"
      style={{ left: offset.x, top: offset.y }}
    >
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 3.2 + index * 0.4, repeat: Infinity, ease: "easeInOut", delay: offset.delay }}
      >
        <Link
          href={`/product/${product.id}`}
          className="group block overflow-hidden rounded-2xl bg-white/95 p-1.5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.45)] ring-1 ring-white/60 backdrop-blur-md transition-transform duration-300 hover:scale-[1.06] hover:shadow-[0_24px_60px_-10px_rgba(0,102,255,0.55)]"
        >
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-100">
            <Image
              src={img}
              alt={product.name}
              fill
              unoptimized
              className="object-cover transition duration-500 group-hover:scale-110"
              sizes="148px"
            />
            <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-neon-500 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white shadow">
              <Flame className="h-2.5 w-2.5" />
              Hot
            </span>
          </div>
          <p className="mt-1.5 line-clamp-1 px-0.5 text-[10px] font-semibold text-ink-800">{product.name}</p>
          <p className="price-mono px-0.5 pb-0.5 text-[11px] font-bold text-electric-600">
            {formatUzs(product.price)}
          </p>
        </Link>
      </motion.div>
    </motion.div>
  );
}

export function HomeSaleHero() {
  const { data } = useFeaturedProducts();
  const products = useMemo(() => (data?.items ?? []).slice(0, 4), [data?.items]);
  const [wordIndex, setWordIndex] = useState(0);

  const liveShoppers = useMemo(() => {
    const hour = new Date().getHours();
    return 32 + ((hour * 7 + new Date().getDate()) % 48);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setWordIndex((i) => (i + 1) % ROTATING_WORDS.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, []);

  const onFeatureClick = (href: string) => {
    if (href === "#stories") {
      scrollToStories();
      return;
    }
  };

  return (
    <section className="mx-auto mb-4 max-w-7xl px-4 pt-3 sm:mb-5 sm:px-6 sm:pt-4">
      <div className="group/hero relative overflow-hidden rounded-[1.75rem] shadow-[0_32px_80px_-24px_rgba(0,70,200,0.55)] ring-1 ring-white/20">
        <div className="absolute inset-0 bg-[#020617]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-95"
          style={{
            background:
              "linear-gradient(125deg, #0047e6 0%, #0066ff 42%, #1d4ed8 68%, #0f172a 100%)",
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#0047e6]/75 via-transparent to-[#0f172a]/40" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 70%, white 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative border-b border-white/10 px-4 py-2 sm:px-6">
          <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80 sm:text-[11px]">
            <span className="inline-flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Hozir {liveShoppers} kishi xarid qilmoqda
            </span>
            <span className="hidden text-white/55 sm:inline">Bozorliii.uz · jonli</span>
          </div>
        </div>

        <div className="relative grid gap-6 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-8">
          <div className="min-w-0 text-white">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ring-1 ring-white/25 backdrop-blur-md"
            >
              <Store className="h-3.5 w-3.5 text-sky-100" />
              {BRAND.shortName} — onlayn bozor
            </motion.p>

            <h1 className="mt-4 text-[1.65rem] font-black leading-[1.08] tracking-tight sm:text-3xl md:text-[2.5rem]">
              Toshkent bozoridan{" "}
              <span className="relative inline-block min-w-[5.5rem] align-bottom">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={ROTATING_WORDS[wordIndex]}
                    initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -14, filter: "blur(6px)" }}
                    transition={{ duration: 0.35 }}
                    className="bg-gradient-to-r from-sky-100 via-white to-sky-50 bg-clip-text text-transparent"
                  >
                    {ROTATING_WORDS[wordIndex]}
                  </motion.span>
                </AnimatePresence>
              </span>
              <br />
              <span className="text-white/95">bir bosishda sizniki</span>
            </h1>

            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/88 sm:text-base">
              {BRAND.tagline}. Xaritadan toping, reels va story orqali ko&apos;ring, 2 daqiqada bron qiling — QR bilan
              olib keting.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {PROOF_CHIPS.map((chip, i) => {
                const Icon = chip.icon;
                return (
                  <motion.span
                    key={chip.label}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 + i * 0.07 }}
                    whileHover={{ scale: 1.04 }}
                    className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-semibold backdrop-blur-sm transition hover:bg-white/18"
                  >
                    <Icon className="h-3.5 w-3.5 text-sky-100" aria-hidden />
                    {chip.label}
                  </motion.span>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link
                href="#catalog"
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-white px-6 py-3 text-sm font-bold text-[#0047e6] shadow-[0_12px_40px_-8px_rgba(255,255,255,0.55)] transition hover:scale-[1.03] hover:bg-amber-50"
              >
                <span className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2.8s_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                <ShoppingBag className="h-4 w-4" />
                Hozir xarid qilish
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/stylist"
                className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-5 py-3 text-sm font-semibold backdrop-blur-md transition hover:scale-[1.02] hover:bg-white/20"
              >
                <Shirt className="h-4 w-4 text-sky-100" />
                AI stylist
              </Link>
              <Link
                href="/reels"
                className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-5 py-3 text-sm font-semibold backdrop-blur-md transition hover:scale-[1.02] hover:bg-white/20"
              >
                <Film className="h-4 w-4" />
                Reels
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="relative mx-auto aspect-[4/3.2] w-full max-w-[420px] sm:aspect-[5/4]">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="absolute left-1/2 top-1/2 z-10 w-[46%] -translate-x-1/2 -translate-y-1/2"
              >
                <div className="rounded-2xl bg-white/95 p-4 shadow-2xl ring-1 ring-white/60 backdrop-blur-xl">
                  <BozorliiiLogo variant="full" size="lg" href="/" />
                  <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                    WOWW bozor tajribasi
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {FEATURE_LINKS.map(({ icon: Icon, label, hint, href, color }) =>
                      href.startsWith("#") ? (
                        <button
                          key={label}
                          type="button"
                          onClick={() => onFeatureClick(href)}
                          className={cn(
                            "flex flex-col items-center rounded-xl bg-gradient-to-b from-white to-slate-50 px-2 py-2.5 text-ink-900 ring-1 ring-slate-200/80 transition duration-300 hover:-translate-y-1",
                            color,
                          )}
                        >
                          <Icon className="h-4 w-4 text-electric-600" aria-hidden />
                          <span className="mt-1 text-[11px] font-bold">{label}</span>
                          <span className="text-[9px] text-slate-500">{hint}</span>
                        </button>
                      ) : (
                        <Link
                          key={label}
                          href={href}
                          className={cn(
                            "flex flex-col items-center rounded-xl bg-gradient-to-b from-white to-slate-50 px-2 py-2.5 text-ink-900 ring-1 ring-slate-200/80 transition duration-300 hover:-translate-y-1",
                            color,
                          )}
                        >
                          <Icon className="h-4 w-4 text-electric-600" aria-hidden />
                          <span className="mt-1 text-[11px] font-bold">{label}</span>
                          <span className="text-[9px] text-slate-500">{hint}</span>
                        </Link>
                      ),
                    )}
                  </div>
                </div>
              </motion.div>

              {products.map((product, i) => (
                <FloatingProductCard
                  key={product.id}
                  product={product}
                  offset={FLOAT_OFFSETS[i] ?? FLOAT_OFFSETS[0]}
                  index={i}
                />
              ))}

              {products.length === 0 ? (
                <>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="absolute h-[120px] w-[100px] animate-pulse rounded-2xl bg-white/15 ring-1 ring-white/20"
                      style={{
                        left: FLOAT_OFFSETS[i]?.x ?? "10%",
                        top: FLOAT_OFFSETS[i]?.y ?? "20%",
                      }}
                    />
                  ))}
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden border-t border-white/10 bg-black/25 py-2">
          <motion.div
            className="flex w-max gap-6 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.16em] text-white/55"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          >
            {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
              <span key={`${item}-${i}`} className="inline-flex items-center gap-2.5">
                <MarqueeSeparator />
                {item}
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
