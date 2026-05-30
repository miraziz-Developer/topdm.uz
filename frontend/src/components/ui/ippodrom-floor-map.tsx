"use client";

import { IppodromMarketMap } from "@/components/ui/ippodrom-market-map";
import { MapPin } from "lucide-react";

import { parseShopLocation } from "@/lib/shop-location";
import { useLocationStore } from "@/stores/location-store";
import type { ShopSummary } from "@/types";

type IppodromFloorMapProps = {
  shop: ShopSummary;
  nearbyShops?: ShopSummary[];
};

export function IppodromFloorMap({ shop, nearbyShops = [] }: IppodromFloorMapProps) {
  const pin = parseShopLocation(shop);
  const setCurrentBlock = useLocationStore((state) => state.setCurrentBlock);
  const shops = [shop, ...nearbyShops.filter((item) => item.id !== shop.id)];

  return (
    <div className="rounded-3xl border border-border-subtle bg-white p-5 shadow-card">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric-500">Ippodrom xaritasi</p>
          <h3 className="mt-1 text-lg font-semibold text-ink-900">{shop.name}</h3>
          <p className="mt-1 flex items-center gap-1 text-sm text-ink-500">
            <MapPin className="h-4 w-4" />
            {pin.label}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCurrentBlock(`${pin.block}-blok`);
            if (typeof navigator !== "undefined" && navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  useLocationStore.getState().setUserGps(pos.coords.latitude, pos.coords.longitude);
                },
                () => {
                  /* fallback: block entrance only */
                },
                { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
              );
            }
          }}
          className="rounded-full border border-border-default px-3 py-1 text-xs font-medium text-ink-700 transition hover:border-electric-500/40"
        >
          Men shu yerda
        </button>
      </div>
      <IppodromMarketMap targetShopId={shop.id} shops={shops} />
    </div>
  );
}
