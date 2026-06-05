"use client";

import Link from "next/link";
import { Flame, TrendingUp } from "lucide-react";

import { ProductRatingStars } from "@/components/product/product-rating-stars";
import { useCurrency } from "@/components/providers/currency-provider";
import { productDiscountPercent, formatSoldCount } from "@/lib/deal-pricing";
import { getGroupPrice } from "@/lib/pricing";
import { ProductPinImage } from "@/components/ui/product-pin-image";
import { isLowStock } from "@/lib/product-stock";
import { productPriceUzs } from "@/lib/product-price";
import type { Product } from "@/types";

type Props = {
  product: Product;
  variant?: "lightning" | "clearance";
};

export function DealProductCard({ product, variant = "lightning" }: Props) {
  const { formatPrice } = useCurrency();
  const base = productPriceUzs(product);
  const group = getGroupPrice(base);
  const discount = productDiscountPercent(product);
  const sold = formatSoldCount(product.sold_count ?? 0);
  const reviews = product.review_summary?.review_count ?? 0;
  const rating = product.review_summary?.average_rating ?? 0;
  const lowStock = isLowStock(product);
  const showGroupHint = group < base;

  return (
    <Link
      href={`/product/${product.id}`}
      className="group flex w-[140px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-border-subtle bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:w-[152px]"
    >
      <div className="relative overflow-hidden bg-elevated">
        <ProductPinImage
          images={product.images}
          alt={product.name}
          aspectClass="aspect-square w-full"
          sizes="152px"
        />
        {discount != null && discount > 0 && variant === "lightning" ? (
          <span className="absolute left-2 top-2 rounded-md bg-neon-500 px-1.5 py-0.5 text-[10px] font-black text-white">
            -{discount}%
          </span>
        ) : null}
        {variant === "lightning" ? (
          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-electric-500/95 text-white shadow">
            <TrendingUp className="h-3 w-3" aria-hidden />
          </span>
        ) : lowStock ? (
          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-600/95 text-white shadow">
            <Flame className="h-3 w-3" aria-hidden />
          </span>
        ) : null}
        {variant === "clearance" && lowStock ? (
          <span className="absolute bottom-2 left-2 z-10 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold text-amber-200">
            Kam qoldi ({product.stock_count})
          </span>
        ) : variant === "clearance" ? (
          <span className="absolute bottom-2 left-2 z-10 rounded bg-amber-600/90 px-1.5 py-0.5 text-[9px] font-bold text-white">
            Arzon narx
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-2.5">
        <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-ink-900">{product.name}</p>
        <div className="mt-1.5 flex items-baseline gap-1">
          <span className="price-mono text-sm font-extrabold text-ink-900">{formatPrice(base)}</span>
        </div>
        {showGroupHint ? (
          <p className="mt-0.5 text-[10px] font-semibold text-electric-600">
            Guruh: {formatPrice(group)}
          </p>
        ) : null}
        <div className="mt-1 flex min-h-[14px] items-center gap-1">
          {reviews > 0 ? (
            <>
              <ProductRatingStars rating={rating} size="sm" />
              <span className="text-[9px] text-ink-500">({reviews})</span>
            </>
          ) : sold ? (
            <p className="text-[9px] font-medium text-emerald-700">{sold} sotilgan</p>
          ) : (
            <span className="text-[9px] text-ink-400">Yangi</span>
          )}
        </div>
      </div>
    </Link>
  );
}
