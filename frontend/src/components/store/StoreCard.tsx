"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";

import { StoreRatingMetrics } from "@/components/store/store-rating-metrics";
import { ProductPinImage } from "@/components/ui/product-pin-image";
import { formatShopAddress } from "@/lib/shop-address";
import { cn } from "@/lib/utils";
import type { Product, ShopSummary } from "@/types";
import { trustMetricsFromStoreRating, type ShopTrustMetrics } from "@/types/shop-trust";

export type StoreCardProps = {
  shop: ShopSummary;
  topProducts?: Product[];
  href: string;
  className?: string;
};

function resolveRating(shop: ShopSummary, indexFallback: number): number {
  if (shop.rating && shop.rating > 0) return shop.rating;
  if (shop.is_featured) return 4.9;
  return Math.min(5, 4.6 + (indexFallback % 4) * 0.1);
}

export function StoreCard({ shop, topProducts = [], href, className }: StoreCardProps) {
  const address = formatShopAddress(shop);
  const storeMetrics = shop.store_rating_metrics;
  const trust: ShopTrustMetrics | undefined =
    shop.trust_metrics ??
    (storeMetrics ? trustMetricsFromStoreRating(storeMetrics) : undefined);
  const reviewCount = storeMetrics?.total_reviews_count ?? shop.review_count ?? 0;
  const rating = storeMetrics?.average_rating ?? resolveRating(shop, 0);

  return (
    <Link
      href={href}
      className={cn(
        "group flex w-[min(100%,280px)] shrink-0 flex-col rounded-2xl border border-border-subtle bg-white/95 p-4 shadow-card backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:border-electric-500/30 hover:shadow-hover active:scale-[0.98] sm:w-[280px]",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-base font-bold text-ink-900 transition-colors group-hover:text-electric-500">
          {shop.name}
        </p>
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-snug text-gray-600">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-electric-500" aria-hidden />
          <span className="line-clamp-2">{address}</span>
        </p>
      </div>

      <StoreRatingMetrics
        rating={rating}
        reviewCount={reviewCount}
        isVerified={shop.is_verified}
        trustMetrics={trust}
        productMatchRate={storeMetrics?.product_match_rate}
        className="mt-3"
      />

      {topProducts.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {topProducts.map((product) => (
            <ProductPinImage
              key={product.id}
              images={product.images}
              alt={product.name}
              aspectClass="aspect-square rounded-lg border border-border-subtle"
              sizes="88px"
            />
          ))}
        </div>
      ) : null}
    </Link>
  );
}
