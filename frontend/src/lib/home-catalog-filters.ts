import type { Product, SearchParams } from "@/types";
import { normalizePriceRange } from "@/lib/price-input";

export type SaleMode = "Chakana" | "Optom";

/** Mahalliy bozor yoki Xitoy (Taobao) vitrinasi */
export type CatalogOrigin = "local" | "china";

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
  catalogOrigin: CatalogOrigin;
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
  catalogOrigin: "local",
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
  const { min, max } = normalizePriceRange(filters.minPrice, filters.maxPrice);

  return products.filter((product) => {
    if (filters.catalogOrigin === "china") return true;
    const saleType = product.sale_type ?? "Chakana";
    if (saleType !== filters.saleMode) return false;
    if (min !== null && product.price < min) return false;
    if (max !== null && product.price > max) return false;

    const hay = productHaystack(product);
    if (filters.marketZone !== "all" && !hay.includes(filters.marketZone.toLowerCase())) return false;
    if (filters.blockSector !== "all" && !hay.includes(filters.blockSector.toLowerCase())) return false;
    if (filters.rootCategory !== "all" && !hay.includes(filters.rootCategory.toLowerCase())) return false;

    return true;
  });
}

/** Foydalanuvchi zona/blok/kategoriya/narx filtrini yoqganmi (bo'sh natijada featured ko'rsatmaslik uchun). */
export function hasActiveBazaarFilters(filters: BazaarCatalogFilters): boolean {
  return (
    filters.marketZone !== "all" ||
    filters.blockSector !== "all" ||
    filters.rootCategory !== "all" ||
    filters.minPrice.trim() !== "" ||
    filters.maxPrice.trim() !== ""
  );
}

export function filtersToSearchParams(filters: BazaarCatalogFilters): SearchParams {
  const params: SearchParams = { limit: 48, page: 1 };
  params.sale_type = filters.saleMode;
  if (filters.marketZone !== "all") params.market_zone = filters.marketZone;
  if (filters.blockSector !== "all") params.block_sector = filters.blockSector;
  if (filters.rootCategory !== "all") params.root_category = filters.rootCategory;
  const { min, max } = normalizePriceRange(filters.minPrice, filters.maxPrice);
  if (min !== null && min > 0) params.min_price = min;
  if (max !== null && max > 0) params.max_price = max;
  return params;
}

/** Filtr maydonlarini UI uchun qayta tartiblash (min > max bo'lsa) */
export function normalizeFilterPrices(filters: BazaarCatalogFilters): BazaarCatalogFilters {
  const { min, max, minSwapped } = normalizePriceRange(filters.minPrice, filters.maxPrice);
  if (!minSwapped) return filters;
  return {
    ...filters,
    minPrice: min !== null ? min.toLocaleString("uz-UZ") : filters.minPrice,
    maxPrice: max !== null ? max.toLocaleString("uz-UZ") : filters.maxPrice,
  };
}

export function filtersAnimationKey(filters: BazaarCatalogFilters): string {
  return [
    filters.catalogOrigin,
    filters.saleMode,
    filters.marketZone,
    filters.blockSector,
    filters.rootCategory,
    filters.minPrice,
    filters.maxPrice,
  ].join("|");
}
