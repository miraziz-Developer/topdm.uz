export type MarketCatalogEntry = {
  slug: string;
  label: string;
  shortLabel: string;
};

export const MAP_MARKETS: MarketCatalogEntry[] = [
  { slug: "ippodrom", label: "Ippodrom", shortLabel: "Ippodrom" },
  { slug: "abu-sahiy", label: "Abu Sahiy", shortLabel: "Abu Sahiy" },
  { slug: "chorsu", label: "Chorsu bozori", shortLabel: "Chorsu" },
  { slug: "kozgalovka", label: "Kozgalovka", shortLabel: "Kozgalovka" },
];

export function normalizeMarketSlug(raw: string | null | undefined): string {
  const key = (raw ?? "ippodrom").trim().toLowerCase();
  return MAP_MARKETS.some((m) => m.slug === key) ? key : "ippodrom";
}

export function marketLabel(slug: string): string {
  return MAP_MARKETS.find((m) => m.slug === slug)?.label ?? "Ippodrom";
}
