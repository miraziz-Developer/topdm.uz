"use client";

import { useMemo } from "react";

import { DealProductCard } from "@/components/home/deal-product-card";
import {
  DOMAIN_CATEGORIES,
  filterProductsByCategory,
  type DomainCategoryId,
} from "@/lib/home-categories";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

type Props = {
  products: Product[];
  loading?: boolean;
  category: DomainCategoryId;
  onCategoryChange: (id: DomainCategoryId) => void;
};

const INTEREST_IDS: DomainCategoryId[] = [
  "all",
  "erkaklar_kiyimi",
  "ayollar_kiyimi",
  "poyabzal",
  "bolalar_kiyimi",
  "matolar",
];

export function HomeRecommendedRow({ products, loading, category, onCategoryChange }: Props) {
  const filtered = useMemo(
    () => filterProductsByCategory(products, category).slice(0, 12),
    [category, products],
  );

  const pills = DOMAIN_CATEGORIES.filter((c) => INTEREST_IDS.includes(c.id));

  if (!loading && products.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto max-w-7xl px-2.5 py-4 min-[360px]:px-4 sm:px-6">
      <h2 className="text-base font-bold text-ink-900">Sizga tavsiya</h2>
      <p className="mt-0.5 text-xs text-ink-500">Qiziqishlaringiz bo&apos;yicha tanlang</p>

      <div className="mobile-scroll-row scrollbar-hide mt-3 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Tavsiya kategoriyalari">
        {pills.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={category === cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={cn(
              "min-h-11 shrink-0 rounded-full px-4 py-2 text-xs font-bold transition",
              category === cat.id
                ? "bg-ink-900 text-white shadow-md"
                : "border border-border-subtle bg-white text-ink-600 hover:border-electric-500/40",
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="mobile-scroll-row scrollbar-hide mt-3 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1" aria-live="polite">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-[220px] w-[140px] shrink-0 rounded-2xl" />
            ))
          : filtered.length > 0
            ? filtered.map((p) => <DealProductCard key={p.id} product={p} variant="lightning" />)
            : (
                <p className="py-6 text-sm text-ink-500">
                  Bu kategoriyada hozircha mahsulot yo&apos;q.
                </p>
              )}
      </div>
    </section>
  );
}
