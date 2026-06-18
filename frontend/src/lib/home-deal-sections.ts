import { productDiscountPercent } from "@/lib/deal-pricing";
import { isLowStock } from "@/lib/product-stock";
import type { Product } from "@/types";

export type HomeDealFeed = {
  lightning: Product[];
  clearance: Product[];
  recommended: Product[];
};

function isClearanceCandidate(product: Product): boolean {
  const discount = productDiscountPercent(product);
  if (discount != null && discount > 0) return true;
  if (isLowStock(product)) return true;
  const attrs = product.attributes ?? {};
  const promo = attrs.promo_percent ?? attrs.discount_percent;
  if (typeof promo === "number" && promo > 0) return true;
  if (typeof promo === "string" && Number.parseInt(promo, 10) > 0) return true;
  return false;
}

/** Bir xil mahsulotni bo'limlar orasida takrorlamaslik. */
export function partitionHomeDealFeed(feed: HomeDealFeed | undefined): HomeDealFeed {
  const lightning = feed?.lightning ?? [];
  const clearanceRaw = feed?.clearance ?? [];
  const recommendedRaw = feed?.recommended ?? [];

  const lightningIds = new Set(lightning.map((p) => p.id));
  const clearance = clearanceRaw.filter(
    (p) => !lightningIds.has(p.id) && isClearanceCandidate(p),
  );
  const clearanceIds = new Set(clearance.map((p) => p.id));

  const seen = new Set<string>([...lightningIds, ...clearanceIds]);
  const recommended = recommendedRaw.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  return { lightning, clearance, recommended };
}
