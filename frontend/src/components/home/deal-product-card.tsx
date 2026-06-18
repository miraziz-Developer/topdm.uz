"use client";

import Link from "next/link";
import { Flame, TrendingUp } from "lucide-react";

import { ProductRatingStars } from "@/components/product/product-rating-stars";
import { useCurrency } from "@/components/providers/currency-provider";
import { productDiscountPercent, formatSoldCount } from "@/lib/deal-pricing";
import { ProductPinImage } from "@/components/ui/product-pin-image";
import { isLowStock } from "@/lib/product-stock";
import { productPriceUzs } from "@/lib/product-price";
import { isOptomProduct, optomCardHint, priceUnitSuffix } from "@/lib/wholesale";
import type { Product } from "@/types";

type Props = {
  product: Product;
  variant?: "lightning" | "clearance";
};

export function DealProductCard({ product, variant = "lightning" }: Props) {
  const { formatPrice } = useCurrency();
  const base = productPriceUzs(product);
  const discount = productDiscountPercent(product);
  const sold = formatSoldCount(product.sold_count ?? 0);
  const reviews = product.review_summary?.review_count ?? 0;
  const rating = product.review_summary?.average_rating ?? 0;
  const lowStock = isLowStock(product);
  const optomHint = optomCardHint(product, formatPrice);
  const unitSuffix = priceUnitSuffix(product);
  const isOptom = isOptomProduct(product);

  return (
    <Link
      href={`/product/${product.id}`}
      className={`group flex w-[140px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg sm:w-[152px] ${
        variant === "lightning"
          ? "border-neon-500/20 ring-1 ring-neon-500/10 hover:border-neon-500/40 hover:ring-neon-500/25"
          : "border-amber-500/20 ring-1 ring-amber-500/10 hover:border-amber-500/40 hover:ring-amber-500/25"
      }`}
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
        {isOptom ? (
          <span className="absolute right-2 top-2 rounded-md bg-electric-500/95 px-1.5 py-0.5 text-[9px] font-bold text-white shadow">
            OPTOM
          </span>
        ) : variant === "lightning" ? (
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
        <div className="mt-1.5 flex items-baseline gap-0.5">
          <span className="price-mono text-sm font-extrabold text-ink-900">{formatPrice(base)}</span>
          {unitSuffix ? <span className="text-[9px] font-medium text-ink-500">{unitSuffix}</span> : null}
        </div>
        {optomHint ? (
          <p className="mt-0.5 line-clamp-2 text-[9px] font-semibold leading-snug text-electric-600">{optomHint}</p>
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
