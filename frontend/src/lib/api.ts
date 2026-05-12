import type { PaginatedProducts, SearchParams, StylistResponse } from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json() as Promise<TResponse>;
}

export async function getJson<TResponse>(path: string): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json() as Promise<TResponse>;
}

export async function searchProducts(params: SearchParams): Promise<PaginatedProducts> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  return getJson<PaginatedProducts>(`/products/search?${query.toString()}`);
}

export async function getProduct(id: string): Promise<unknown> {
  return getJson(`/products/${id}`);
}

export async function getSimilarProducts(id: string): Promise<unknown> {
  return getJson(`/products/${id}/similar`);
}

export async function trackEvent(payload: {
  event_type: "view" | "lead" | "visit" | "share";
  product_id?: string;
  shop_id?: string;
  ref_token?: string;
  session_id?: string;
  metadata?: Record<string, unknown>;
}): Promise<unknown> {
  return postJson("/tracking/events", payload);
}

export async function createLead(payload: {
  product_id: string;
  shop_id: string;
  customer_phone: string;
  customer_name?: string;
  ref_token?: string;
}): Promise<unknown> {
  return postJson("/leads", payload);
}

export async function stylistLookbook(payload: {
  user_id: string;
  text?: string;
  image_url?: string;
  min_price?: number;
  max_price?: number;
  block?: string;
}): Promise<StylistResponse> {
  return postJson<StylistResponse>("/stylist/lookbook", payload);
}

export async function getShopDashboard(shopId: string): Promise<unknown> {
  return getJson(`/dashboard/shop/${shopId}`);
}
