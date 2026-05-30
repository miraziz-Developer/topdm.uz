import type { ShopSummary } from "@/types";

/** Human-readable stall address from seeded shop fields. */
export function formatShopAddress(shop: ShopSummary): string {
  const market = (shop.ipadrom || "Ippodrom").replace(/\s+bozor(i)?$/i, "").trim();
  const floor = shop.floor?.trim();
  const stall = (shop.section || shop.shop_number)?.trim();

  const locationParts: string[] = [];
  if (market) locationParts.push(`${market} bloki`);
  if (floor) locationParts.push(floor);
  if (stall) locationParts.push(stall);

  return locationParts.length > 0 ? locationParts.join(", ") : "Toshkent bozori";
}
