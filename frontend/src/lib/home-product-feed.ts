import {
  getClearanceDeals,
  getFeaturedProducts,
  getJson,
  getLightningDeals,
  searchProducts,
} from "@/lib/api";
import { partitionHomeDealFeed, type HomeDealFeed } from "@/lib/home-deal-sections";
import type { Product } from "@/types";

export type { HomeDealFeed };

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

  const lightningIds = new Set(lightning.map((p) => p.id));
  clearance = clearance.filter((p) => !lightningIds.has(p.id));

  const used = new Set([...lightningIds, ...clearance.map((p) => p.id)]);
  let recommended: Product[] = [];
  try {
    const search = await searchProducts({ limit, page: 1 });
    recommended = (search.items ?? []).filter((p) => !used.has(p.id));
  } catch {
    recommended = [];
  }

  return {
    lightning: lightning.slice(0, limit),
    clearance: clearance.slice(0, limit),
    recommended: recommended.slice(0, limit),
  };
}

export async function loadHomeDealFeed(limit = 16): Promise<HomeDealFeed> {
  const unified = await fetchDealFeed(limit);
  const raw = unified ?? (await legacyFallback(limit));
  return partitionHomeDealFeed(raw);
}
