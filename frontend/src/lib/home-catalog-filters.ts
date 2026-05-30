import type { Product, SearchParams } from "@/types";

export type SaleMode = "Chakana" | "Optom";

export type MarketZoneId = "all" | "Abu Sahiy" | "Ippodrom" | "Kozgalovka";

export type BlockSectorId =
  | "all"
  | "Chorsu bloki"
  | "Toshkent yo'lagi"
  | "1-Glavniy"
  | "Yevropa bloki";

export type RootCategoryId =
  | "all"
  | "Kiyim-kechak & Moda"
  | "Poyabzal"
  | "Go'zallik & Parfümeriya"
  | "Matolar & Tekstil"
  | "Aksessuarlar"
  | "Bolalar & Maktab";

export type BazaarCatalogFilters = {
  saleMode: SaleMode;
  marketZone: MarketZoneId;
  blockSector: BlockSectorId;
  rootCategory: RootCategoryId;
  minPrice: string;
  maxPrice: string;
};

export const MARKET_ZONES: Array<{ id: MarketZoneId; label: string }> = [
  { id: "all", label: "Hammasi" },
  { id: "Abu Sahiy", label: "Abu Sahiy" },
  { id: "Ippodrom", label: "Ippodrom" },
  { id: "Kozgalovka", label: "Kozgalovka" },
];

export const BLOCK_SECTORS: Array<{ id: BlockSectorId; label: string }> = [
  { id: "all", label: "Barcha bloklar" },
  { id: "Chorsu bloki", label: "Chorsu bloki" },
  { id: "Toshkent yo'lagi", label: "Toshkent yo'lagi" },
  { id: "1-Glavniy", label: "1-Glavniy" },
  { id: "Yevropa bloki", label: "Yevropa bloki" },
];

export const ROOT_CATEGORIES: Array<{ id: RootCategoryId; label: string }> = [
  { id: "all", label: "Barcha kategoriyalar" },
  { id: "Kiyim-kechak & Moda", label: "Kiyim-kechak & Moda" },
  { id: "Poyabzal", label: "Poyabzal" },
  { id: "Go'zallik & Parfümeriya", label: "Go'zallik & Parfümeriya" },
  { id: "Matolar & Tekstil", label: "Matolar & Tekstil" },
  { id: "Aksessuarlar", label: "Aksessuarlar" },
  { id: "Bolalar & Maktab", label: "Bolalar & Maktab" },
];

export const DEFAULT_BAZAAR_FILTERS: BazaarCatalogFilters = {
  saleMode: "Chakana",
  marketZone: "all",
  blockSector: "all",
  rootCategory: "all",
  minPrice: "",
  maxPrice: "",
};

function productHaystack(product: Product): string {
  const shop = product.shop;
  return [
    product.name,
    product.category,
    product.root_category,
    product.sub_category,
    shop?.name,
    shop?.ipadrom,
    shop?.market_zone,
    shop?.block_sector,
    shop?.location_label,
    shop?.floor,
    shop?.section,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterProductsClient(
  products: Product[],
  filters: BazaarCatalogFilters,
): Product[] {
  const min = filters.minPrice.trim() ? Number(filters.minPrice.replace(/\s/g, "")) : null;
  const max = filters.maxPrice.trim() ? Number(filters.maxPrice.replace(/\s/g, "")) : null;

  return products.filter((product) => {
    const saleType = product.sale_type ?? "Chakana";
    if (saleType !== filters.saleMode) return false;
    if (min !== null && !Number.isNaN(min) && product.price < min) return false;
    if (max !== null && !Number.isNaN(max) && product.price > max) return false;

    const hay = productHaystack(product);
    if (filters.marketZone !== "all" && !hay.includes(filters.marketZone.toLowerCase())) return false;
    if (filters.blockSector !== "all" && !hay.includes(filters.blockSector.toLowerCase())) return false;
    if (filters.rootCategory !== "all" && !hay.includes(filters.rootCategory.toLowerCase())) return false;

    return true;
  });
}

export function filtersToSearchParams(filters: BazaarCatalogFilters): SearchParams {
  const params: SearchParams = { limit: 48, page: 1 };
  params.sale_type = filters.saleMode;
  if (filters.marketZone !== "all") params.market_zone = filters.marketZone;
  if (filters.blockSector !== "all") params.block_sector = filters.blockSector;
  const min = filters.minPrice.trim() ? Number(filters.minPrice.replace(/\s/g, "")) : NaN;
  const max = filters.maxPrice.trim() ? Number(filters.maxPrice.replace(/\s/g, "")) : NaN;
  if (!Number.isNaN(min) && min > 0) params.min_price = min;
  if (!Number.isNaN(max) && max > 0) params.max_price = max;
  return params;
}

export function filtersAnimationKey(filters: BazaarCatalogFilters): string {
  return [
    filters.saleMode,
    filters.marketZone,
    filters.blockSector,
    filters.rootCategory,
    filters.minPrice,
    filters.maxPrice,
  ].join("|");
}
