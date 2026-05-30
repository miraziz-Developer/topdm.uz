export type SaleType = "Chakana" | "Optom";

export interface LiveStory {
  id: string;
  shop_id: string;
  image_url: string;
  level_context: string;
  created_at: string;
  expires_at: string;
  is_hot: boolean;
  route_path: string;
  shop: ShopSummary;
}

export interface ShopSummary {
  id: string;
  name: string;
  slug?: string;
  ipadrom: string;
  floor: string;
  section?: string;
  shop_number?: string;
  phone?: string;
  is_featured?: boolean;
  is_verified?: boolean;
  rating?: number;
  review_count?: number;
  store_rating_metrics?: import("@/types/shop-trust").StoreRatingMetrics;
  trust_metrics?: import("@/types/shop-trust").ShopTrustMetrics;
  market_zone?: string;
  block_sector?: string;
  location_label?: string;
}

export interface ShopProfile {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  storefront_image_url?: string | null;
  floor?: string | null;
  section?: string | null;
  address_label?: string | null;
  is_verified: boolean;
  rating: number;
  review_count?: number;
  trust_metrics?: import("@/types/shop-trust").ShopTrustMetrics;
  ipadrom_id?: string | null;
  ipadrom?: string | null;
  ipadrom_name?: string | null;
  is_featured?: boolean;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  /** Stored catalog price in UZS (always use for formatting when present). */
  price_uzs?: number;
  currency?: string;
  is_fallback?: boolean;
  visual_match?: boolean;
  visual_match_pct?: number;
  match_mode?: string;
  sale_type?: SaleType;
  min_order_quantity?: number;
  images: string[];
  category?: string;
  root_category?: string;
  sub_category?: string;
  market_zone?: string;
  block_sector?: string;
  is_available: boolean;
  stock_count?: number;
  is_featured?: boolean;
  view_count?: number;
  attributes?: Record<string, unknown>;
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
  sale_type?: SaleType;
  market_zone?: string;
  block_sector?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
}

export interface DetectedOutfitItem {
  id: string;
  label_uz: string;
  category?: string;
  color?: string;
  material?: string;
  search_query: string;
  bbox: { x: number; y: number; w: number; h: number };
  thumbnail_url: string;
  products: Product[];
  total: number;
  is_fallback?: boolean;
  vision?: {
    category?: string;
    color?: string;
    material?: string;
    style_tags?: string[];
  };
}

export interface PhotoSearchResponse {
  items: Product[];
  total: number;
  page: number;
  vision: {
    category?: string;
    color?: string;
    material?: string;
    style_tags?: string[];
  };
  query_label: string;
  detected_items?: DetectedOutfitItem[];
  mode?: string;
  is_fallback?: boolean;
  assistant_text?: string;
  jonli_katalog_natijasi?: {
    exact_count?: number;
    vector_neighbor_count?: number;
    match_mode?: string;
    vector_neighbors?: Product[];
    is_fallback?: boolean;
  };
}

export interface StylistLookbookItem {
  product_id: string;
  reason: string;
  product?: Product;
}

export interface StylistResponse {
  source: "fresh" | "cache";
  intent: { intent: string; style: string; reason?: string; occasion?: string };
  lookbook: StylistLookbookItem[];
  explanation: string;
}

export interface AuthMeResponse {
  id: string;
  email: string | null;
  telegram_id: number | null;
  phone: string | null;
  display_name: string | null;
  role: "consumer" | "merchant";
  has_email: boolean;
  has_telegram: boolean;
  shop: ShopProfile | null;
  shop_id?: string | null;
}

export interface OrderTrackerStep {
  status: string;
  label: string;
}

export interface Order {
  id: string;
  status: string;
  quantity: number;
  total_price: number;
  note?: string | null;
  ref_token?: string | null;
  fulfillment_type?: string;
  pickup_date?: string | null;
  pickup_time?: string | null;
  pickup_window_label?: string | null;
  status_label?: string;
  tracker_steps?: OrderTrackerStep[];
  tracker_active_index?: number;
  tracker_progress_pct?: number;
  created_at?: string | null;
  updated_at?: string | null;
  product: {
    id: string;
    name: string;
    price: number;
    images: string[];
  };
  shop: {
    id: string;
    name: string;
    slug: string;
    ipadrom?: string;
    floor?: string | null;
    section?: string | null;
    block_sector?: string | null;
  };
}
