"use client";

import Link from "next/link";
import { Loader2, Star, Store } from "lucide-react";

import { ShopLocationDetailsCard } from "@/components/map/shop-location-details";
import { locationDetailsFromMarker } from "@/lib/map/shop-location-display";
import { formatPrice } from "@/lib/utils";
import type { ShopPopupData } from "@/hooks/useIppodromMapPage";
import { cn } from "@/lib/utils";

type ShopMapPopupProps = {
  data: ShopPopupData;
  compact?: boolean;
  /** Pastki sheetda joylashuv allaqachon yuqorida — takrorlanmasin. */
  hideLocation?: boolean;
};

export function ShopMapPopupContent({ data, compact = false, hideLocation = false }: ShopMapPopupProps) {
  const { shop, vendorTag, topProducts, loading } = data;
  const location = locationDetailsFromMarker(shop);

  return (
    <div className={cn(compact ? "py-2" : "p-4")}>
      {!compact ? (
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-electric text-white shadow-sm">
            <Store className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink-900">{shop.name}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-electric-500">{vendorTag}</p>
            {shop.rating != null && shop.rating > 0 ? (
              <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {shop.rating.toFixed(1)}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-[11px] font-semibold text-electric-500">{vendorTag}</p>
      )}

      {!hideLocation ? (
        <ShopLocationDetailsCard location={location} compact={compact} className={compact ? "mt-2" : "mt-3"} />
      ) : null}

      <div className={cn("border-t border-border-subtle", compact ? "mt-2 pt-2" : "mt-3 pt-3")}>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500">Top mahsulotlar</p>
        {loading ? (
          <div className="flex items-center justify-center py-6 text-ink-500">
            <Loader2 className="h-5 w-5 animate-spin text-electric-500" />
          </div>
        ) : topProducts.length === 0 ? (
          <p className="py-3 text-xs text-ink-500">Mahsulotlar hozircha ko&apos;rsatilmayapti.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {topProducts.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/product/${product.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition hover:bg-elevated/80"
                >
                  <span className="line-clamp-1 text-xs font-medium text-ink-700">{product.name}</span>
                  <span className="shrink-0 text-xs font-bold text-electric-500">{formatPrice(product.price)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!compact && shop.slug ? (
        <Link
          href={`/shop/${shop.slug}`}
          className="mt-3 block rounded-xl bg-electric-500 py-2.5 text-center text-xs font-bold text-white transition hover:bg-electric-400"
        >
          Do&apos;konga kirish
        </Link>
      ) : null}
    </div>
  );
}
