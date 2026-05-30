/** Parse /search deep-link query params from stylist wardrobe flow. */

export type SearchDeeplinkParams = {
  q: string;
  style: string;
  categories: string[];
  maxPrice?: number;
};

export function parseSearchUrlParams(search?: string | null): SearchDeeplinkParams {
  const safe = typeof search === "string" ? search : "";
  const params = new URLSearchParams(safe.startsWith("?") ? safe.slice(1) : safe);
  const categoryRaw = params.get("category") || "";
  const categories = categoryRaw
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const maxRaw = params.get("max_price");
  const maxPrice = maxRaw && /^\d+$/.test(maxRaw) ? Number(maxRaw) : undefined;
  return {
    q: params.get("q") || "",
    style: params.get("style") || "",
    categories,
    maxPrice,
  };
}

export function buildSearchQueryFromDeeplink(query: Record<string, string>): string {
  const parts: string[] = [];
  if (query.q) parts.push(query.q);
  if (query.style) parts.push(query.style.replace(/-/g, " "));
  if (query.category) parts.push(query.category.replace(/,/g, " "));
  return parts.join(" ").trim() || "klassik look";
}
