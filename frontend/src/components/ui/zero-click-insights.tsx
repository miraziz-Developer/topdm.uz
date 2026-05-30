"use client";

import { MapPin, PiggyBank, TrendingUp } from "lucide-react";
import Link from "next/link";

import { formatPrice } from "@/lib/utils";
import type { Product } from "@/types";

type ZeroClickInsightsProps = {
  items: Product[];
  /** Global trend cards when the active query has zero matches. */
  trendFallback?: Product[];
};

export function ZeroClickInsights({ items, trendFallback = [] }: ZeroClickInsightsProps) {
  if (items.length > 0) {
    const cheapest = [...items].sort((a, b) => a.price - b.price)[0];
    const nearest = [...items].sort((a, b) => (a.shop.floor || "9").localeCompare(b.shop.floor || "9"))[0];

    return (
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-3xl border border-electric-500/25 bg-electric-500/5 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-electric-500">
            <PiggyBank className="h-4 w-4" />
            Eng arzon do&apos;kon
          </p>
          <p className="mt-2 text-sm font-medium text-ink-900">{cheapest.name}</p>
          <p className="price-mono mt-1 text-lg font-bold text-neon-500">{formatPrice(cheapest.price)}</p>
          <p className="mt-1 text-xs text-ink-500">{cheapest.shop.name}</p>
        </div>
        <div className="rounded-3xl border border-neon-500/25 bg-neon-500/5 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-neon-500">
            <MapPin className="h-4 w-4" />
            Eng yaqin do&apos;kon
          </p>
          <p className="mt-2 text-sm font-medium text-ink-900">{nearest.name}</p>
          <p className="mt-1 text-xs text-ink-500">
            {nearest.shop.ipadrom} • {nearest.shop.floor || "1-qavat"}
          </p>
        </div>
      </div>
    );
  }

  if (!trendFallback.length) return null;

  return (
    <div className="mb-6 rounded-3xl border border-border-subtle bg-white/90 p-4 backdrop-blur-sm">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-electric-500">
        <TrendingUp className="h-4 w-4" />
        Global trend tavsiyalar
      </p>
      <p className="mt-1 text-sm text-ink-500">Hozirgi bozordagi mashhur tovarlar — tanishib chiqing.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {trendFallback.slice(0, 4).map((product) => (
          <Link
            key={product.id}
            href={`/product/${product.id}`}
            className="rounded-2xl border border-border-subtle px-4 py-3 transition hover:border-electric-500/40 hover:bg-elevated/50"
          >
            <p className="line-clamp-2 text-sm font-medium text-ink-900">{product.name}</p>
            <p className="price-mono mt-1 text-sm font-bold text-neon-500">{formatPrice(product.price)}</p>
            <p className="mt-0.5 text-xs text-ink-500">{product.shop?.name}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
