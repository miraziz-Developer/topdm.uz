"use client";

import { ExternalLink, MapPin, Store } from "lucide-react";
import Link from "next/link";

import { buildMapFocusHref } from "@/lib/map-stores";
import { formatShopLocationBadge, parseShopLocation } from "@/lib/shop-location";
import type { Product } from "@/types";

type PickupStoreLocationsProps = {
  products: Product[];
};

export function PickupStoreLocations({ products }: PickupStoreLocationsProps) {
  const shops = products
    .map((p) => p.shop)
    .filter((shop): shop is NonNullable<Product["shop"]> => Boolean(shop?.id))
    .filter((shop, index, arr) => arr.findIndex((s) => s.id === shop.id) === index);

  if (!shops.length) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Do&apos;kon manzili hali biriktirilmagan.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
        Qayerdan olib ketasiz ({shops.length} do&apos;kon)
      </p>
      {shops.map((shop) => {
        const pin = parseShopLocation(shop);
        const mapHref = buildMapFocusHref({
          merchantId: shop.id,
          shopSlug: shop.slug,
          block: pin.block,
          stall: pin.stall,
          focus: true,
          source: "order",
        });
        const badge = formatShopLocationBadge(shop);
        const comment = shop.location_label?.trim();

        return (
          <div
            key={shop.id}
            className="rounded-2xl border border-electric-500/15 bg-gradient-to-br from-electric-500/[0.05] to-white p-4"
          >
            <div className="flex items-start gap-2">
              <Store className="mt-0.5 h-4 w-4 shrink-0 text-electric-500" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink-900">{shop.name}</p>
                <p className="mt-1 flex items-start gap-1.5 text-sm leading-snug text-ink-700">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-electric-500" />
                  <span>{badge}</span>
                </p>
                {comment && comment !== badge ? (
                  <p className="mt-1 text-xs text-ink-500">{comment}</p>
                ) : null}
              </div>
            </div>
            <Link
              href={mapHref}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-electric-600 hover:underline"
            >
              Xaritada ko&apos;rish
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        );
      })}
    </div>
  );
}
