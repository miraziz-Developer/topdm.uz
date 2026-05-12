export interface ShopSummary {
  id: string;
  name: string;
  ipadrom: string;
  floor: string;
  phone?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  images: string[];
  category?: string;
  is_available: boolean;
  view_count?: number;
  shop: ShopSummary;
}

export interface Lead {
  id: string;
  customer_phone: string;
  customer_name?: string;
  status: string;
  ref_token?: string;
}

export interface SearchParams {
  q?: string;
  category_id?: string;
  ipadrom_id?: string;
  min_price?: number;
  max_price?: number;
  page?: number;
  limit?: number;
}

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
}

export interface StylistResponse {
  source: "fresh" | "cache";
  intent: { intent: string; style: string; reason?: string };
  lookbook: Array<{ product_id: string; reason: string }>;
  explanation: string;
}
