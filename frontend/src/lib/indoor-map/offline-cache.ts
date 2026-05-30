import type { IndoorMarketMapResponse } from "@/lib/api";

const prefix = "bozor-indoor-map:";

export function cacheIndoorMap(marketSlug: string, payload: IndoorMarketMapResponse) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${prefix}${marketSlug}`, JSON.stringify({ savedAt: Date.now(), payload }));
  } catch {
    /* quota */
  }
}

export function readCachedIndoorMap(marketSlug: string): IndoorMarketMapResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${prefix}${marketSlug}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { payload: IndoorMarketMapResponse };
    return parsed.payload ?? null;
  } catch {
    return null;
  }
}
