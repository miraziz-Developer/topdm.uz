import {
  getClearanceDeals,
  getFeaturedProducts,
  getJson,
  getLightningDeals,
  searchProducts,
} from "@/lib/api";
import type { Product } from "@/types";

export type HomeDealFeed = {
  lightning: Product[];
  clearance: Product[];
  recommended: Product[];
};

async function fetchDealFeed(limit: number): Promise<HomeDealFeed | null> {
  try {
    const data = await getJson<{
      lightning: Product[];
      clearance: Product[];
      recommended: Product[];
    }>(`/home/deal-feed?limit=${limit}`, false, true);
    if (data.lightning?.length || data.clearance?.length) {
      return {
        lightning: data.lightning ?? [],
        clearance: data.clearance ?? [],
        recommended: data.recommended ?? data.lightning ?? [],
      };
    }
  } catch {
    /* fallback below */
  }
  return null;
}

async function legacyFallback(limit: number): Promise<HomeDealFeed> {
  let lightning: Product[] = [];
  let clearance: Product[] = [];

  try {
    lightning = (await getLightningDeals(limit)).items ?? [];
  } catch {
    /* old backend */
  }
  try {
    clearance = (await getClearanceDeals(limit)).items ?? [];
  } catch {
    /* old backend */
  }

  if (lightning.length < 4) {
    try {
      const featured = await getFeaturedProducts();
      const seen = new Set(lightning.map((p) => p.id));
      for (const p of featured.items ?? []) {
        if (!seen.has(p.id)) {
          lightning.push(p);
          seen.add(p.id);
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (lightning.length < 4) {
    try {
      const search = await searchProducts({ limit, page: 1 });
      const seen = new Set(lightning.map((p) => p.id));
      for (const p of search.items ?? []) {
        if (!seen.has(p.id)) {
          lightning.push(p);
          seen.add(p.id);
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (clearance.length < 4) {
    const seen = new Set(clearance.map((p) => p.id));
    const sorted = [...lightning].sort(
      (a, b) => (a.price_uzs ?? a.price) - (b.price_uzs ?? b.price),
    );
    for (const p of sorted) {
      if (!seen.has(p.id) && clearance.length < limit) {
        clearance.push(p);
        seen.add(p.id);
      }
    }
  }

  return {
    lightning: lightning.slice(0, limit),
    clearance: clearance.slice(0, limit),
    recommended: lightning.slice(0, limit),
  };
}

export async function loadHomeDealFeed(limit = 16): Promise<HomeDealFeed> {
  const unified = await fetchDealFeed(limit);
  if (unified) return unified;
  return legacyFallback(limit);
}
