"use client";

import Image from "next/image";
import Link from "next/link";
import { Film, MapPin, Search, Sparkles, Store } from "lucide-react";

import { BRAND } from "@/components/brand/brand-tokens";

const FEATURES = [
  { icon: MapPin, label: "Xarita", hint: "Rastani toping" },
  { icon: Film, label: "Reels", hint: "Do'kon videolari" },
  { icon: Store, label: "Story", hint: "Jonli vitrina" },
  { icon: Search, label: "AI qidiruv", hint: "Rasm yoki matn" },
] as const;

export function HomeSaleHero() {
  return (
    <section className="mx-auto mb-4 max-w-7xl px-4 pt-3 sm:mb-5 sm:px-6 sm:pt-4">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0047e6] via-[#0066ff] to-[#ff4d12] px-5 py-6 text-white shadow-[0_24px_60px_-16px_rgba(0,102,255,0.55)] sm:px-8 sm:py-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="pointer-events-none absolute -right-6 -top-6 h-44 w-44 rounded-full bg-white/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-0 h-36 w-56 rounded-full bg-amber-300/25 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ring-1 ring-white/25 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-amber-200" />
              {BRAND.shortName} — onlayn bozor
            </p>
            <h1 className="mt-3 text-2xl font-black leading-[1.1] tracking-tight sm:text-3xl md:text-[2.35rem]">
              Toshkent bozori —{" "}
              <span className="bg-gradient-to-r from-amber-200 to-white bg-clip-text text-transparent">
                endi cho&apos;ntagingizda
              </span>
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/90 sm:text-base">
              {BRAND.tagline}. Do&apos;konni xaritadan toping, mahsulotni ko&apos;ring, bron qiling — reels, story va
              chat ham shu yerda.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="#catalog"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#0047e6] shadow-lg transition hover:scale-[1.02] hover:bg-amber-50"
              >
                <Store className="h-4 w-4" />
                Mahsulotlarni ko&apos;rish
              </Link>
              <Link
                href="/stylist"
                className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-5 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/20"
              >
                <Search className="h-4 w-4" />
                AI stylist
              </Link>
              <Link
                href="/reels"
                className="inline-flex items-center rounded-full border border-white/35 bg-white/10 px-5 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/20"
              >
                <Film className="h-4 w-4" />
                Reels
              </Link>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-4 sm:flex-row lg:flex-col lg:items-end">
            <div className="flex items-center gap-3 rounded-2xl bg-black/20 px-4 py-3 ring-1 ring-white/20 backdrop-blur-md">
              <div className="relative h-14 w-14 overflow-hidden rounded-xl bg-white shadow-lg ring-2 ring-white/40">
                <Image
                  src={BRAND.assets.icon}
                  alt={BRAND.shortName}
                  fill
                  className="object-contain p-1.5"
                  sizes="56px"
                  priority
                />
              </div>
              <div className="text-left">
                <p className="text-lg font-black leading-none tracking-tight">{BRAND.shortName}</p>
                <p className="mt-0.5 text-xs font-medium text-white/75">{BRAND.name}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
              {FEATURES.map(({ icon: Icon, label, hint }) => (
                <div
                  key={label}
                  className="flex min-w-[4.5rem] flex-col items-center rounded-xl bg-white/10 px-2.5 py-2 ring-1 ring-white/15 backdrop-blur-sm"
                >
                  <Icon className="h-4 w-4 text-amber-200" aria-hidden />
                  <span className="mt-1 text-[11px] font-bold">{label}</span>
                  <span className="text-[9px] text-white/60">{hint}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
