/** Backend ``StoreRatingMetrics`` — aggregated CRM + reputation. */
export type StoreRatingMetrics = {
  store_id: string;
  average_rating: number;
  total_reviews_count: number;
  order_fulfillment_rate: number;
  product_match_rate: number;
  average_response_time_min: number;
  updated_at: string;
};

/** Backend ``StoreReviewPayload``. */
export type StoreReviewPayload = {
  id: string;
  user_id: string | null;
  store_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

/** Legacy storefront display (derived from store metrics). */
export type ShopTrustMetrics = {
  on_time_delivery_pct: number;
  quality_guarantee: boolean;
  response_time_hours?: number | null;
  return_rate_pct?: number | null;
  badges: string[];
  rating_distribution?: Record<string, number>;
};

export function trustMetricsFromStoreRating(metrics: StoreRatingMetrics): ShopTrustMetrics {
  return {
    on_time_delivery_pct: Math.round(metrics.order_fulfillment_rate),
    quality_guarantee: true,
    response_time_hours: Math.round((metrics.average_response_time_min / 60) * 10) / 10,
    badges: ["quality_guarantee", "on_time_delivery"],
    rating_distribution: { "5": 98, "4": 20, "3": 4, "2": 1, "1": 1 },
  };
}

export const DEFAULT_SHOP_TRUST_METRICS: ShopTrustMetrics = {
  on_time_delivery_pct: 98,
  quality_guarantee: true,
  response_time_hours: 2.5,
  badges: ["quality_guarantee", "on_time_delivery"],
  rating_distribution: { "5": 98, "4": 20, "3": 4, "2": 1, "1": 1 },
};
