"use client";

import Image from "next/image";
import Link from "next/link";

import { isLocalDevMedia, productImage, resolveMediaUrl } from "@/lib/media";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/types";

type StylistProductSuggestionsProps = {
  items: Array<{ product: Product; reason: string }>;
  onNavigate?: () => void;
};

export function StylistProductSuggestions({ items, onNavigate }: StylistProductSuggestionsProps) {
  if (!items.length) return null;

  return (
    <div className="mt-3 w-full min-w-0">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-text-400">
        Bazadan topilgan variantlar
      </p>
      <div className="flex w-full gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(({ product, reason }) => (
          <Link
            key={product.id}
            href={`/product/${product.id}`}
            onClick={onNavigate}
            className="w-[140px] shrink-0 snap-start rounded-xl border border-border-subtle bg-surface p-2 transition-transform hover:scale-[1.01] hover:border-gold-500/40"
          >
            <div className="relative h-24 w-full overflow-hidden rounded-lg bg-elevated">
              <Image
                src={productImage(product.images)}
                alt={product.name}
                fill
                unoptimized={
                  productImage(product.images).startsWith("data:") ||
                  isLocalDevMedia(resolveMediaUrl(productImage(product.images)))
                }
                className="object-cover"
                sizes="140px"
              />
            </div>
            <h5 className="mt-1.5 truncate text-[11px] font-semibold text-text-100">{product.name}</h5>
            <p className="price-mono mt-0.5 text-[10px] font-bold text-electric-500">{formatPrice(product.price)}</p>
            {product.shop?.shop_number || product.shop?.section ? (
              <p className="mt-0.5 truncate text-[10px] font-medium text-ink-500">
                {product.shop.floor ? `${product.shop.floor} · ` : ""}
                {product.shop.shop_number || product.shop.section}
              </p>
            ) : null}
            <p className="mt-1 line-clamp-2 text-[10px] text-text-400">{reason}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
