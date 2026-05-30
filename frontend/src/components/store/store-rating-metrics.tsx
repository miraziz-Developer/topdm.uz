"use client";

import { CheckCircle2, Star, Truck } from "lucide-react";

import { cn } from "@/lib/utils";
import { DEFAULT_SHOP_TRUST_METRICS, type ShopTrustMetrics } from "@/types/shop-trust";

type StoreRatingMetricsProps = {
  rating?: number;
  reviewCount?: number;
  isVerified?: boolean;
  trustMetrics?: ShopTrustMetrics | null;
  productMatchRate?: number;
  className?: string;
};

function formatReviewCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k ta sharh`;
  return `${count} ta sharh`;
}

function distributionRows(metrics: ShopTrustMetrics, total: number) {
  const dist = metrics.rating_distribution ?? DEFAULT_SHOP_TRUST_METRICS.rating_distribution ?? {};
  return [5, 4, 3, 2, 1].map((star) => {
    const count = dist[String(star)] ?? 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return { star, count, pct };
  });
}

export function StoreRatingMetrics({
  rating = 4.9,
  reviewCount = 0,
  isVerified = false,
  trustMetrics,
  productMatchRate,
  className,
}: StoreRatingMetricsProps) {
  const metrics = trustMetrics ?? DEFAULT_SHOP_TRUST_METRICS;
  const displayRating = rating > 0 ? rating.toFixed(1) : "—";
  const totalReviews =
    reviewCount > 0 ? reviewCount : Object.values(metrics.rating_distribution ?? {}).reduce((a, b) => a + b, 0);
  const rows = distributionRows(metrics, totalReviews || 124);

  return (
    <div className={cn("flex flex-col space-y-1", className)}>
      <div className="group/rating relative flex items-center gap-1.5">
        <div className="flex items-center gap-1 rounded-full border border-amber-200/60 bg-amber-50 px-2 py-0.5 text-amber-700">
          <Star size={12} className="fill-amber-500 text-amber-500" aria-hidden />
          <span className="text-[11px] font-bold">{displayRating}</span>
          {isVerified ? <CheckCircle2 size={11} className="text-amber-600" aria-label="Tasdiqlangan" /> : null}
        </div>
        {totalReviews > 0 ? (
          <span className="text-xs font-medium text-neutral-400">({formatReviewCount(totalReviews)})</span>
        ) : null}

        <div
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-56 rounded-xl border border-border-subtle bg-white p-3 opacity-0 shadow-lg transition-opacity group-hover/rating:pointer-events-auto group-hover/rating:opacity-100 group-focus-within/rating:opacity-100"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Sharh taqsimoti</p>
          <ul className="mt-2 space-y-1.5">
            {rows.map(({ star, pct }) => (
              <li key={star} className="flex items-center gap-2 text-[10px] text-neutral-600">
                <span className="w-3 font-semibold">{star}</span>
                <Star size={10} className="fill-amber-400 text-amber-400" />
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right font-medium">{pct}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {metrics.on_time_delivery_pct > 0 ? (
          <span className="rounded-md border border-green-100 bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
            %{metrics.on_time_delivery_pct} o&apos;z vaqtida yetkazish
          </span>
        ) : null}
        {metrics.quality_guarantee ? (
          <span className="rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
            Sifat kafolati
          </span>
        ) : null}
        {productMatchRate != null && productMatchRate >= 90 ? (
          <span className="rounded-md border border-violet-100 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
            %{Math.round(productMatchRate)} tavsifga mos
          </span>
        ) : null}
        {metrics.badges?.includes("on_time_delivery") && metrics.on_time_delivery_pct <= 0 ? (
          <span className="inline-flex items-center gap-0.5 rounded-md border border-green-100 bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
            <Truck size={10} />
            Tez yetkazish
          </span>
        ) : null}
      </div>
    </div>
  );
}
