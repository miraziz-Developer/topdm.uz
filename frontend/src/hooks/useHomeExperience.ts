"use client";

import { useEffect, useRef, useState } from "react";

import { getHomeExperience, type HomeExperience } from "@/lib/api";
import type { BazaarCatalogFilters } from "@/lib/home-catalog-filters";
import { DEFAULT_BAZAAR_FILTERS } from "@/lib/home-catalog-filters";
import { buildClientHints, marketZoneFromHint } from "@/lib/personalization/client-hints";
import { readGuestPhone } from "@/lib/guest-phone";
import { useAuthStore } from "@/stores/auth-store";

type Options = {
  bazaarFilters: BazaarCatalogFilters;
  onApplyCatalogHints?: (patch: Partial<BazaarCatalogFilters>) => void;
};

export function useHomeExperience(options: Options) {
  const { bazaarFilters, onApplyCatalogHints } = options;
  const [experience, setExperience] = useState<HomeExperience | null>(null);
  const hydrated = useAuthStore((s) => s.hydrated);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const appliedHints = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    const hints = buildClientHints({
      preferredMarket: bazaarFilters.marketZone !== "all" ? bazaarFilters.marketZone : undefined,
      saleMode: bazaarFilters.saleMode,
    });
    const guest = readGuestPhone();
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(hints)) {
      query.set(k, String(v));
    }
    if (!isLoggedIn && guest) {
      query.set("guest_phone", guest);
    }

    let cancelled = false;
    void getHomeExperience(query)
      .then((data) => {
        if (cancelled) return;
        setExperience(data);
        if (!appliedHints.current && onApplyCatalogHints && data.catalog_hints) {
          appliedHints.current = true;
          const patch: Partial<BazaarCatalogFilters> = {};
          const hints = data.catalog_hints;
          if (hints.sale_mode === "Optom" || hints.sale_mode === "Chakana") {
            patch.saleMode = hints.sale_mode;
          }
          const mz = marketZoneFromHint(String(hints.market_zone || ""));
          if (mz) patch.marketZone = mz;
          if (Object.keys(patch).length) {
            onApplyCatalogHints(patch);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setExperience(null);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, isLoggedIn, bazaarFilters.marketZone, bazaarFilters.saleMode, onApplyCatalogHints]);

  return experience;
}

export { DEFAULT_BAZAAR_FILTERS };
