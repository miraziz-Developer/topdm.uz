"use client";

import { ArrowRight, BadgeCheck, MapPinned, Search, ShieldCheck, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import { useFeaturedProducts } from "@/hooks/useFeaturedProducts";
import { productImage } from "@/lib/media";

function formatUzs(value: number): string {
  return `${value.toLocaleString("uz-UZ")} so‘m`;
}

export function HomeSaleHero() {
  const { data } = useFeaturedProducts();
  const products = useMemo(() => (data?.items ?? []).slice(0, 3), [data?.items]);

  return (
    <section className="px-3 pb-7 pt-3 sm:px-5 sm:pb-10 sm:pt-5" aria-labelledby="home-hero-title">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[1.75rem] bg-[#0c172e] text-white shadow-[0_28px_70px_-36px_rgba(12,23,46,.75)] sm:rounded-[2.25rem]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -right-40 -top-64 h-[38rem] w-[38rem] rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute -bottom-56 left-1/4 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:42px_42px]" />
        </div>

        <div className="relative grid min-h-[32rem] items-center gap-10 px-5 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.05fr_.95fr] lg:px-16 lg:py-16">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-300/10 px-3 py-1.5 text-xs font-bold text-blue-200">
              <BadgeCheck className="h-4 w-4" aria-hidden /> Mahalliy bozoringiz — endi onlayn
            </div>
            <h1 id="home-hero-title" className="mt-5 text-balance text-[2.35rem] font-black leading-[1.04] tracking-[-0.045em] sm:text-5xl lg:text-[3.8rem]">
              Kerakli mahsulotni <span className="text-blue-300">tezroq toping.</span>
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-base font-medium leading-7 text-slate-300 sm:text-lg sm:leading-8">
              Bozor do‘konlari, real narxlar va mahsulotlar bitta joyda. Qidiring, taqqoslang va sotuvchidan oldindan band qiling.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/search" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#2468e8] px-6 text-sm font-bold text-white shadow-[0_12px_30px_-12px_rgba(36,104,232,.9)] transition hover:-translate-y-0.5 hover:bg-[#3274ee] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300/30">
                <Search className="h-4 w-4" aria-hidden /> Mahsulot qidirish
              </Link>
              <Link href="/map" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-6 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20">
                <MapPinned className="h-4 w-4" aria-hidden /> Bozor xaritasi
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-slate-300 sm:text-sm">
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Tekshirilgan do‘konlar</span>
              <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-orange-300" /> AI orqali qidiruv</span>
            </div>
          </div>

          <div className="relative mx-auto hidden h-[25rem] w-full max-w-[31rem] lg:block" aria-label="Tavsiya etilgan mahsulotlar">
            <div className="absolute inset-8 rounded-[2rem] border border-white/10 bg-white/[0.055] backdrop-blur-sm" />
            <div className="absolute inset-x-14 top-14 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm text-slate-300 backdrop-blur">
              <Search className="mr-2 inline h-4 w-4 text-blue-300" aria-hidden /> Mahsulot, do‘kon yoki kategoriya...
            </div>
            <div className="absolute inset-x-0 bottom-5 grid grid-cols-3 items-end gap-3">
              {products.length > 0
                ? products.map((product, index) => (
                    <Link key={product.id} href={`/product/${product.id}`} className={`group overflow-hidden rounded-2xl border border-white/60 bg-white p-2 text-slate-950 shadow-2xl transition duration-300 hover:-translate-y-2 ${index === 1 ? "mb-8" : ""}`}>
                      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-100">
                        <Image src={productImage(product.images)} alt={product.name} fill sizes="180px" className="object-cover transition duration-500 group-hover:scale-105" />
                      </div>
                      <p className="mt-2 truncate px-1 text-xs font-bold">{product.name}</p>
                      <p className="px-1 pb-1 text-[11px] font-extrabold text-[#1857d6]">{formatUzs(product.price)}</p>
                    </Link>
                  ))
                : [0, 1, 2].map((index) => (
                    <div key={index} className={`rounded-2xl border border-white/20 bg-white/10 p-2 ${index === 1 ? "mb-8" : ""}`}>
                      <div className="aspect-[4/5] animate-pulse rounded-xl bg-white/10" />
                      <div className="mt-3 h-2.5 w-3/4 animate-pulse rounded bg-white/10" />
                      <div className="mb-1 mt-2 h-2.5 w-1/2 animate-pulse rounded bg-white/10" />
                    </div>
                  ))}
            </div>
            <Link href="#catalog" className="absolute -right-1 top-4 inline-flex items-center gap-1 rounded-full bg-orange-500 px-3 py-2 text-xs font-extrabold text-white shadow-lg transition hover:bg-orange-400">
              Katalog <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}