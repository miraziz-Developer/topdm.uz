import { getJson } from "@/lib/api";

export type PriceBreakdown = {
  base_price_cny: number;
  cny_to_uzs_rate: number;
  base_price_uzs: number;
  margin_pct: number;
  margin_amount_uzs: number;
  weight_kg: number;
  cargo_rate_usd_per_kg: number;
  usd_to_uzs_rate: number;
  cargo_uzs: number;
  subtotal_before_round_uzs: number;
  round_step_uzs: number;
  total_price_uzs: number;
};

export type SkuVariant = {
  sku_id: string;
  color?: string | null;
  size?: string | null;
  price_cny?: number | null;
  stock?: number | null;
  image_url?: string | null;
};

export type ChinaProduct = {
  market: "china";
  item_id: string;
  title: string;
  images: string[];
  description?: string | null;
  colors: string[];
  sizes: string[];
  skus: SkuVariant[];
  weight_kg: number;
  base_price_cny: number;
  pricing: PriceBreakdown;
  source_url?: string | null;
};

export type LocalProduct = {
  market: "local";
  item_id: string;
  name: string;
  images: string[];
  description?: string | null;
  stock_count: number;
  is_available: boolean;
  colors: string[];
  sizes: string[];
  size_matrix: Record<string, string[]>;
  shop: {
    id: string;
    name: string;
    slug: string;
    location_label?: string | null;
    floor?: string | null;
    stall?: string | null;
  };
  product_price_uzs: number;
  courier_fee_uzs: number;
  courier_eta_label: string;
  pricing: PriceBreakdown;
};

export function formatUzs(value: number): string {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(value)) + " so'm";
}

export async function fetchChinaProduct(itemId: string) {
  const encoded = encodeURIComponent(itemId);
  return getJson<{ item: ChinaProduct }>(`/market/china/${encoded}`);
}

export async function fetchLocalProduct(itemId: string) {
  return getJson<{ item: LocalProduct }>(`/market/local/${itemId}`);
}
