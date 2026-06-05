import type { SaleMode, MarketZoneId } from "@/lib/home-catalog-filters";

const VISIT_KEY = "bozorliii_visit_count";
const LAST_SHOP_KEY = "bozorliii_last_shop";
const SESSION_KEY = "bozorliii_session_id";

export type LastShopHint = { slug: string; name: string };

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function bumpVisitCount(): number {
  if (typeof window === "undefined") return 1;
  const prev = Number.parseInt(localStorage.getItem(VISIT_KEY) || "0", 10);
  const next = Number.isFinite(prev) ? prev + 1 : 1;
  localStorage.setItem(VISIT_KEY, String(next));
  return next;
}

export function getVisitCount(): number {
  if (typeof window === "undefined") return 1;
  const n = Number.parseInt(localStorage.getItem(VISIT_KEY) || "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function saveLastShop(shop: LastShopHint): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_SHOP_KEY, JSON.stringify(shop));
}

export function getLastShop(): LastShopHint | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_SHOP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastShopHint;
    if (parsed?.slug) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

/** Watchlist favorites count (zustand persist). */
export function getFavoritesCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem("bozorliii-watchlist");
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { state?: { favorites?: Record<string, true> } };
    const fav = parsed?.state?.favorites;
    return fav ? Object.keys(fav).length : 0;
  } catch {
    return 0;
  }
}

export function getRecentViewsCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem("bozorliii-watchlist");
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { state?: { items?: Record<string, unknown> } };
    return parsed?.state?.items ? Object.keys(parsed.state.items).length : 0;
  } catch {
    return 0;
  }
}

export function buildClientHints(options?: {
  preferredMarket?: string;
  saleMode?: SaleMode;
}): Record<string, string | number> {
  const last = getLastShop();
  const market =
    options?.preferredMarket && options.preferredMarket !== "all"
      ? options.preferredMarket
      : undefined;
  return {
    visit_count: getVisitCount(),
    session_id: getOrCreateSessionId(),
    favorites_count: getFavoritesCount(),
    liked_products_count: getFavoritesCount(),
    recent_views_count: getRecentViewsCount(),
    locale: "uz",
    ...(options?.saleMode ? { sale_mode: options.saleMode } : {}),
    ...(last ? { last_shop_slug: last.slug, last_shop_name: last.name } : {}),
    ...(market ? { preferred_market: market } : {}),
  };
}

export function marketZoneFromHint(zone: string): MarketZoneId | null {
  const map: Record<string, MarketZoneId> = {
    Ippodrom: "Ippodrom",
    "Abu Sahiy": "Abu Sahiy",
    Kozgalovka: "Kozgalovka",
  };
  return map[zone] ?? null;
}
