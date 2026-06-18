"use client";

import { ArrowRight, MapPin, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { useCurrency } from "@/components/providers/currency-provider";
import { ProductRatingStars } from "@/components/product/product-rating-stars";
import {
  shopCardShell,
  shopTypeDisplay,
  shopTypeEyebrow,
  shopTypeLead,
  shopTypeMeta,
  shopTypePrice,
} from "@/components/shop/shop-premium-ui";
import { productImage } from "@/lib/media";
import { productPriceUzs } from "@/lib/product-price";
import { isLowStock } from "@/lib/product-stock";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

type Props = {
  product: Product;
  shopName: string;
  shopSlug: string;
};

export function ShopFeaturedProduct({ product, shopName, shopSlug }: Props) {
  const { formatPrice } = useCurrency();
  const img = productImage(product.images);
  const price = productPriceUzs(product);
  const lowStock = isLowStock(product);
  const href = product.detail_path ?? `/product/${product.id}`;
  const summary = product.review_summary;

  return (
    <article className={cn("shop-featured-product", shopCardShell)}>
      <div className="grid gap-0 md:grid-cols-[1.05fr_0.95fr]">
        <Link href={href} className="group relative block aspect-[4/5] bg-[#f3f1ed] md:aspect-auto md:min-h-[420px]">
          <Image
            src={img}
            alt={product.name}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.02]"
            sizes="(max-width: 768px) 100vw, 55vw"
            priority
            unoptimized
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
          {lowStock ? (
            <span className="absolute left-4 top-4 rounded-full bg-rose-500/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-sm">
              Oxirgi donalar
            </span>
          ) : null}
        </Link>

        <div className="flex flex-col justify-center px-5 py-6 sm:px-8 sm:py-9">
          <p className={shopTypeEyebrow}>Asosiy mahsulot</p>
          <h2 className={cn(shopTypeDisplay, "mt-3 text-[1.75rem] sm:text-[2rem]")}>{product.name}</h2>
          <p className={cn(shopTypeMeta, "mt-2.5 text-text-400")}>
            {shopName} kolleksiyasidan tanlov
          </p>

          {summary && summary.review_count > 0 ? (
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <ProductRatingStars rating={summary.average_rating} size="sm" />
              <span className={cn(shopTypeMeta, "tabular-nums text-text-300")}>
                {summary.average_rating.toFixed(1)}
                <span className="text-text-400"> · </span>
                {summary.review_count} sharh
              </span>
            </div>
          ) : null}

          <p className={cn(shopTypePrice, "price-mono mt-6 text-[2rem] sm:text-[2.35rem]")}>
            {formatPrice(price)}
          </p>

          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
            <Link
              href={href}
              className="shop-hero-btn shop-hero-btn--primary inline-flex flex-1 items-center justify-center gap-2"
            >
              Ko&apos;rish va bron qilish
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/map?shop=${encodeURIComponent(shopSlug)}`}
              className="shop-hero-btn shop-hero-btn--secondary inline-flex items-center justify-center gap-2"
            >
              <MapPin className="h-4 w-4" />
              Do&apos;konga borish
            </Link>
          </div>

          <p className={cn(shopTypeLead, "mt-6 flex items-start gap-2.5 rounded-2xl bg-[#faf7f2] px-4 py-3.5 text-[13px] text-text-300 ring-1 ring-[#ebe6df]")}>
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600/90" aria-hidden />
            Onlayn tanlang, do&apos;konda naqd yoki terminalda to&apos;lang — olib keting.
          </p>
        </div>
      </div>
    </article>
  );
}
