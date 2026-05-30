export const IPPODROM_CENTER = { lat: 41.2346, lng: 69.1834 };

export const MARKET_LABELS: Record<string, string> = {
  ippodrom: "Chilonzor Ippodrom bozori",
  "abu-saxiy": "Abu Saxiy bozori",
  dordoy: "Dordoy bozori",
};

export function marketDisplayName(slug: string): string {
  return MARKET_LABELS[slug.toLowerCase()] ?? slug;
}
