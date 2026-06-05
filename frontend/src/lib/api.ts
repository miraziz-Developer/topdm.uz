import { apiFetch } from "@/lib/http-client";
import type {
  AuthMeResponse,
  Order,
  PaginatedProducts,
  PhotoSearchResponse,
  Product,
  SearchParams,
  LiveStory,
  ShopProfile,
  ShopSummary,
  StylistResponse,
} from "@/types";

export type AuthTokenResponse = {
  status: string;
  token: string;
  role: string;
  id: string;
  email: string | null;
  telegram_id: number | null;
  phone: string | null;
  display_name: string | null;
  has_email: boolean;
  has_telegram: boolean;
  shop_id: string | null;
  dev_otp?: string;
};

export async function postJson<TResponse>(
  path: string,
  body: unknown,
  auth = false,
  options?: { timeoutMs?: number; silent?: boolean },
): Promise<TResponse> {
  return apiFetch<TResponse>(path, {
    method: "POST",
    body: JSON.stringify(body),
    auth,
    timeoutMs: options?.timeoutMs,
    silent: options?.silent,
  });
}

export async function getJson<TResponse>(path: string, auth = false, silent = false): Promise<TResponse> {
  return apiFetch<TResponse>(path, { method: "GET", cache: "no-store", auth, silent });
}

export async function patchJson<TResponse>(path: string, body: unknown, auth = true): Promise<TResponse> {
  return apiFetch<TResponse>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
    auth,
  });
}

export async function searchProducts(params: SearchParams): Promise<PaginatedProducts> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  return getJson<PaginatedProducts>(`/products/search?${query.toString()}`);
}

export async function searchProductsByImage(
  file: File,
  page = 1,
  limit = 24,
  intent?: string,
  fast = true,
): Promise<PhotoSearchResponse> {
  const form = new FormData();
  form.append("file", file);
  if (intent?.trim()) {
    form.append("q", intent.trim());
  }
  const fastParam = fast ? "&fast=true" : "&fast=false";
  return apiFetch<PhotoSearchResponse>(`/products/search-by-image?page=${page}&limit=${limit}${fastParam}`, {
    method: "POST",
    body: form,
    timeoutMs: fast ? 60_000 : 180_000,
  });
}

export async function transcribeVoiceSearch(audio: Blob): Promise<{ text: string }> {
  const form = new FormData();
  form.append("file", audio, "voice.webm");
  return apiFetch<{ text: string }>("/search/transcribe", {
    method: "POST",
    body: form,
    timeoutMs: 25_000,
  });
}

export type VisualSearchRefinePayload = {
  label_uz: string;
  search_query: string;
  selected_category: string;
  color?: string | null;
  material?: string | null;
  intent_text?: string | null;
  min_price?: number | null;
  max_price?: number | null;
  limit?: number;
  crop_base64?: string | null;
};

export type VisualSearchRefineResponse = {
  products: Product[];
  total: number;
  category: string;
  selected_category: string;
  label_uz: string;
  is_fallback?: boolean;
};

export async function refineVisualSearchCategory(
  body: VisualSearchRefinePayload,
): Promise<VisualSearchRefineResponse> {
  return postJson<VisualSearchRefineResponse>("/products/search-visual-refine", body);
}

export interface LookSearchResponse {
  items: Product[];
  total: number;
  page: number;
  mode?: string;
  query?: string;
  is_fallback?: boolean;
  assistant_text?: string;
  selected_product_ids?: string[];
}

export async function searchProductsLook(q: string, page = 1, limit = 24): Promise<LookSearchResponse> {
  return postJson<LookSearchResponse>(`/products/search-look?page=${page}&limit=${limit}`, { q });
}

export async function getProduct(id: string): Promise<Product> {
  return getJson<Product>(`/products/${id}`);
}

export async function getSimilarProducts(id: string): Promise<{ items: Product[] }> {
  return getJson<{ items: Product[] }>(`/products/${id}/similar`);
}

export type ProductReviewSummary = {
  average_rating: number;
  review_count: number;
  distribution: Record<string, number>;
};

export type ProductReview = {
  id: string;
  product_id: string;
  author_name: string;
  rating: number;
  body: string | null;
  photo_urls: string[];
  is_verified_purchase: boolean;
  created_at: string | null;
};

export type ProductReviewsResponse = ProductReviewSummary & {
  items: ProductReview[];
  limit: number;
  offset: number;
};

export async function getProductReviews(
  productId: string,
  limit = 12,
  offset = 0,
): Promise<ProductReviewsResponse> {
  return getJson<ProductReviewsResponse>(
    `/products/${productId}/reviews?limit=${limit}&offset=${offset}`,
  );
}

export async function submitProductReview(
  productId: string,
  fields: {
    rating: number;
    body?: string;
    /** Odatda yuborilmaydi — backend profildan oladi. */
    author_name?: string;
    customer_phone?: string;
  },
  photos: File[] = [],
): Promise<{ review: ProductReview; summary: ProductReviewSummary }> {
  const form = new FormData();
  form.append("rating", String(fields.rating));
  if (fields.author_name?.trim()) form.append("author_name", fields.author_name.trim());
  if (fields.body) form.append("body", fields.body);
  if (fields.customer_phone?.trim()) form.append("customer_phone", fields.customer_phone.trim());
  for (const file of photos) {
    form.append("photos", file);
  }
  return apiFetch(`/products/${productId}/reviews`, {
    method: "POST",
    body: form,
    credentials: "include",
  });
}

export async function getShopBySlug(slug: string): Promise<ShopProfile> {
  return getJson<ShopProfile>(`/shops/${slug}`);
}

export async function getShopProducts(slug: string): Promise<{ shop: ShopProfile; items: Product[] }> {
  return getJson<{ shop: ShopProfile; items: Product[] }>(`/shops/${slug}/products`);
}

export async function getFeaturedProducts(): Promise<{ items: Product[] }> {
  return getJson<{ items: Product[] }>("/products/featured");
}

export async function getLightningDeals(limit = 16): Promise<{ items: Product[] }> {
  return getJson<{ items: Product[] }>(`/products/deals/lightning?limit=${limit}`, false, true);
}

export async function getClearanceDeals(limit = 16): Promise<{ items: Product[] }> {
  return getJson<{ items: Product[] }>(`/products/deals/clearance?limit=${limit}`, false, true);
}

export async function getLiveStories(limit = 40): Promise<{ items: LiveStory[] }> {
  return getJson<{ items: LiveStory[] }>(`/market/stories/live?limit=${limit}`, false, true);
}

export async function getStoryDock(limit = 15): Promise<{
  items: import("@/types").StoryDockRing[];
  empty_state?: { code: string; title: string; message: string } | null;
}> {
  return getJson(`/market/stories/dock?limit=${limit}`, false, true);
}

export async function getShopStories(shopId: string): Promise<{
  shop_id: string;
  shop: import("@/types").ShopSummary;
  items: LiveStory[];
  count: number;
}> {
  return getJson(`/market/stories/shop/${encodeURIComponent(shopId)}`, false, true);
}

export async function getMerchantStories(): Promise<{ items: LiveStory[] }> {
  return getJson<{ items: LiveStory[] }>("/merchants/stories", true);
}

export async function getPremiumBanners(limit = 24) {
  return getJson<import("@/types/premium-banner").PremiumBannersResponse>(
    `/home/premium-banners?limit=${limit}`,
    false,
    true,
  );
}

export async function trackPremiumBannerImpression(bannerId: string) {
  return postJson<{ status: string }>(`/home/premium-banners/${encodeURIComponent(bannerId)}/impression`, {}, false, {
    silent: true,
  });
}

export async function trackPremiumBannerClick(bannerId: string) {
  return postJson<{ status: string }>(`/home/premium-banners/${encodeURIComponent(bannerId)}/click`, {}, false, {
    silent: true,
  });
}

export async function getCrmBannerTariffs() {
  return getJson<{ items: import("@/types/crm-banner").CrmTariff[] }>("/crm/banners/tariffs", true);
}

export async function getCrmMerchantWallet() {
  return getJson<import("@/types/crm-banner").MerchantWallet>("/crm/banners/wallet", true);
}

export async function getCrmMyBanners() {
  return getJson<{ items: import("@/types/crm-banner").CrmBannerCampaign[] }>("/crm/banners/mine", true);
}

export async function getCrmBannerStats(bannerId: string) {
  return getJson<import("@/types/crm-banner").CrmBannerStats>(`/crm/banners/${encodeURIComponent(bannerId)}/stats`, true);
}

export async function createCrmBanner(payload: {
  tariff_code: string;
  title?: string;
  image?: File;
  image_url?: string;
  cta_path?: string;
}) {
  const form = new FormData();
  form.append("tariff_code", payload.tariff_code);
  if (payload.title) form.append("title", payload.title);
  if (payload.image_url) form.append("image_url", payload.image_url);
  if (payload.cta_path) form.append("cta_path", payload.cta_path);
  if (payload.image) form.append("image", payload.image);
  return apiFetch<{
    status: string;
    banner: import("@/types/crm-banner").CrmBannerCampaign;
    payment: { amount_uzs: number; amount_coins: number; tariff_code: string; package_days: number; queue_position: number };
  }>("/crm/banners/create", { method: "POST", body: form, auth: true });
}

export async function verifyCrmBannerPayment(payload: {
  banner_id: string;
  payment_method: "coin" | "click" | "payme";
  external_reference?: string;
}) {
  return postJson<{ status: string; banner: import("@/types/crm-banner").CrmBannerCampaign }>(
    "/crm/banners/verify-payment",
    payload,
    true,
  );
}

export async function renewCrmBanner(payload: { banner_id: string; tariff_code?: string }) {
  return postJson<{ status: string; banner: import("@/types/crm-banner").CrmBannerCampaign }>(
    "/crm/banners/renew",
    payload,
    true,
  );
}

export async function getCoinPackages() {
  return getJson<{ items: Array<{ id: string; code: string; name_uz: string; coins: number; amount_uzs: number }> }>(
    "/payments/coin-packages",
    true,
  );
}

export async function generatePaymentInvoice(payload: {
  shop_id?: string;
  coin_package_id: string;
  provider: "click" | "payme" | "manual";
}) {
  return postJson<{
    transaction_id: string;
    checkout_url: string;
    status: string;
    coins_added: number;
    amount_uzs: number;
  }>("/payments/generate-invoice", payload, true);
}

export async function getCrmCarouselSettings() {
  return getJson<{ carousel: Record<string, unknown>; version: number }>("/crm/banners/carousel-settings", true);
}

export async function patchCrmCarouselSettings(payload: {
  enabled?: boolean;
  crossfade?: boolean;
  autoplay?: boolean;
  interval_ms?: number;
}) {
  return patchJson<{ carousel: Record<string, unknown>; version: number }>(
    "/crm/banners/carousel-settings",
    payload,
    true,
  );
}

export async function purchaseCrmBanner(payload: {
  tariff_code: string;
  title?: string;
  image?: File;
  image_url?: string;
  cta_path?: string;
}) {
  const form = new FormData();
  form.append("tariff_code", payload.tariff_code);
  if (payload.title) form.append("title", payload.title);
  if (payload.image_url) form.append("image_url", payload.image_url);
  if (payload.cta_path) form.append("cta_path", payload.cta_path);
  if (payload.image) form.append("image", payload.image);
  return apiFetch<{
    status: string;
    coins_balance: number;
    coins_spent: number;
    banner: import("@/types/crm-banner").CrmBannerCampaign;
  }>("/crm/banners/purchase", { method: "POST", body: form, auth: true });
}

export async function buyCrmBannerWithCoins(payload: {
  tariff_code: string;
  title?: string;
  image?: File;
  image_url?: string;
  cta_path?: string;
}) {
  const form = new FormData();
  form.append("tariff_code", payload.tariff_code);
  if (payload.title) form.append("title", payload.title);
  if (payload.image_url) form.append("image_url", payload.image_url);
  if (payload.cta_path) form.append("cta_path", payload.cta_path);
  if (payload.image) form.append("image", payload.image);
  return apiFetch<{
    status: string;
    coins_balance: number;
    coins_spent: number;
    banner: import("@/types/crm-banner").CrmBannerCampaign;
  }>("/crm/banners/buy-with-coins", { method: "POST", body: form, auth: true });
}

export async function sendTelegramOtp(telegram_username: string) {
  return postJson<{ status: string; telegram_username: string; delivery: string; dev_otp?: string }>(
    "/auth/send-otp",
    { telegram_username },
  );
}

export async function verifyTelegramOtp(payload: { telegram_username: string; otp: string; phone?: string }) {
  return postJson<AuthTokenResponse>("/auth/verify-otp", payload);
}

export async function sendEmailOtp(email: string) {
  return postJson<{ status: string; email: string; delivery: string; dev_otp?: string }>(
    "/auth/email/send-otp",
    { email },
  );
}

export async function verifyEmailOtp(payload: { email: string; otp: string; phone?: string }) {
  return postJson<AuthTokenResponse>("/auth/email/verify-otp", payload);
}

export async function authTelegram(payload: Record<string, unknown>) {
  return postJson<AuthTokenResponse>("/auth/telegram", payload);
}

export async function linkTelegram(payload: Record<string, unknown>) {
  return postJson<{ status: string; telegram_id: number }>("/auth/link/telegram", payload, true);
}

export async function getAuthMe(): Promise<AuthMeResponse> {
  return getJson<AuthMeResponse>("/auth/me", true, true);
}

export async function patchAuthMePhone(phone: string) {
  return patchJson<{ status: string; phone: string }>("/auth/me/phone", { phone }, true);
}

export async function createOrder(
  payload: {
    product_id: string;
    quantity?: number;
    note?: string;
    ref_token?: string;
  },
  options?: { silent?: boolean },
): Promise<{ order_id: string; status: string; total_price: number }> {
  return postJson("/orders", payload, true, { silent: options?.silent });
}

export type StoreAddressPayload = {
  block: string;
  floor: string;
  stall: string;
  formatted: string;
};

export type PickupReservationResponse = {
  reservations: Array<{
    order_id: string;
    product_id: string;
    shop_id: string;
    quantity: number;
    total_price: number;
    status: string;
  }>;
  reservation_count: number;
  total_price: number;
  status: string;
  pickup_date: string;
  pickup_time: string;
  pickup_window_label: string;
  payment_method: string;
  payment_method_label: string;
  store_location: string;
  store_address: StoreAddressPayload;
  merchant_phone: string;
  shop_name: string;
  shop_slug: string;
  map_url: string;
  checkout_id?: string | null;
  online_checkout_url?: string | null;
};

export type DeliveryQuoteOption = {
  carrier_class: "express" | "cargo";
  label: string;
  delivery_cost_uzs: number;
  eta_minutes?: number | null;
  offer_payload?: string | null;
  billable_weight_kg?: number;
  total_volume_m3?: number;
};

export type DeliveryQuoteResponse = {
  shop_id: string;
  shop_name: string;
  product_subtotal_uzs: number;
  recommended_carrier: "express" | "cargo";
  options: DeliveryQuoteOption[];
  total_payable_uzs: number;
};

export type DeliveryReservationResponse = {
  reservations: Array<{
    order_id: string;
    product_id: string;
    shop_id: string;
    quantity: number;
    total_price: number;
    status: string;
  }>;
  reservation_count: number;
  product_subtotal_uzs: number;
  delivery_cost_uzs: number;
  total_payable_uzs: number;
  carrier_class: "express" | "cargo";
  fulfillment_type: "delivery";
  delivery_eta_minutes?: number | null;
};

export type CheckoutPaymentOptions = {
  in_store: Array<"cash" | "terminal">;
  online: {
    click: boolean;
    payme: boolean;
    bridge: boolean;
  };
};

export async function getCheckoutPaymentOptions(): Promise<CheckoutPaymentOptions> {
  return getJson<CheckoutPaymentOptions>("/platform/checkout-payment-options", false);
}

export async function fetchPaymentRedirect(params: {
  provider: "click" | "payme";
  amount: number;
  checkout_id?: string;
  order_id?: string;
}): Promise<{ url: string | null; bridge_url?: string; message?: string }> {
  const search = new URLSearchParams({
    provider: params.provider,
    amount: String(params.amount),
  });
  if (params.checkout_id) search.set("checkout_id", params.checkout_id);
  if (params.order_id) search.set("order_id", params.order_id);
  return getJson(`/platform/payment-redirect?${search.toString()}`, false);
}

export async function reservePickupOrders(
  payload: {
    items: Array<{ product_id: string; quantity: number }>;
    user_phone: string;
    user_email?: string;
    pickup_date: string;
    pickup_time: string;
    payment_method: "cash" | "terminal" | "click" | "payme";
    note?: string;
    ref_token?: string;
  },
  options?: { silent?: boolean },
): Promise<PickupReservationResponse> {
  return postJson<PickupReservationResponse>("/orders/reserve", payload, false, {
    silent: options?.silent,
  });
}

export async function quoteDeliveryOptions(payload: {
  items: Array<{ product_id: string; quantity: number }>;
  user_phone: string;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  destination_city?: string;
}): Promise<DeliveryQuoteResponse> {
  return postJson<DeliveryQuoteResponse>("/delivery/quote", payload, false);
}

export async function reserveDeliveryOrders(payload: {
  items: Array<{ product_id: string; quantity: number }>;
  user_phone: string;
  user_email?: string;
  payment_method: "cash" | "terminal" | "click" | "payme";
  note?: string;
  ref_token?: string;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  destination_city?: string;
  carrier_class: "express" | "cargo";
  delivery_cost_uzs: number;
  delivery_eta_minutes?: number;
  offer_payload?: string;
}): Promise<DeliveryReservationResponse> {
  return postJson<DeliveryReservationResponse>("/orders/reserve-delivery", payload, false);
}

export async function getMyOrders(): Promise<{ items: Order[] }> {
  return getJson<{ items: Order[] }>("/orders/me", true);
}

/** Mehmon buyurtmalar — login shart emas, telefon bo'yicha. */
export async function lookupOrdersByPhone(user_phone: string): Promise<{ items: Order[] }> {
  return postJson<{ items: Order[] }>(
    "/orders/lookup",
    { user_phone },
    false,
    { silent: true },
  );
}

export async function getMyOrder(orderId: string): Promise<Order> {
  return getJson<Order>(`/orders/${orderId}`, true);
}

export async function trackEvent(payload: {
  event_type: "view" | "lead" | "visit" | "share";
  product_id?: string;
  shop_id?: string;
  ref_token?: string;
  session_id?: string;
  metadata?: Record<string, unknown>;
}): Promise<unknown> {
  const body: Record<string, unknown> = { event_type: payload.event_type, metadata: payload.metadata ?? {} };
  if (payload.product_id?.trim()) body.product_id = payload.product_id.trim();
  if (payload.shop_id?.trim()) body.shop_id = payload.shop_id.trim();
  if (payload.ref_token?.trim()) body.ref_token = payload.ref_token.trim();
  if (payload.session_id?.trim()) body.session_id = payload.session_id.trim();
  return postJson("/tracking/events", body, false, { silent: true });
}

export async function createLead(
  payload: {
    product_id: string;
    shop_id?: string;
    customer_phone: string;
    customer_name?: string;
    note?: string;
    ref_token?: string;
  },
  options?: { silent?: boolean },
): Promise<{ lead_id: string; status: string }> {
  const body: Record<string, unknown> = {
    product_id: payload.product_id,
    phone: payload.customer_phone,
  };
  if (payload.customer_name?.trim()) body.customer_name = payload.customer_name.trim();
  if (payload.note?.trim()) body.note = payload.note.trim();
  if (payload.ref_token?.trim()) body.ref_token = payload.ref_token.trim();
  if (payload.shop_id?.trim()) body.shop_id = payload.shop_id.trim();
  return postJson("/leads", body, false, { silent: options?.silent });
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

export type ChatAgentProductSnapshot = {
  id: string;
  name: string;
  price: number;
  images: string[];
  category?: string | null;
  is_available: boolean;
  is_featured?: boolean;
  view_count?: number;
  shop: ShopSummary & { shop_number?: string; section?: string };
};

export type ChatAgentWardrobeSlot = {
  role: string;
  product_id: string;
  item: ChatAgentProductSnapshot;
};

export type ChatAgentBlock =
  | { type: "text"; content: string }
  | { type: "product_cards"; product_ids: string[]; items: ChatAgentProductSnapshot[] }
  | { type: "wardrobe_bundle"; slots: ChatAgentWardrobeSlot[]; product_ids?: string[] }
  | {
      type: "mini_map";
      market_slug: string;
      level: number;
      start_node_id: string;
      goal_node_id: string;
      route: { node_ids: string[]; points: Array<{ x: number; y: number }>; distance: number };
    };

export type ChatAgentSearchDeeplink = {
  path: string;
  query: Record<string, string>;
};

export type ChatAgentTurnResponse = {
  source: string;
  assistant_text: string;
  blocks: ChatAgentBlock[];
  route?: string;
  engine?: string;
  locale?: string;
  fallback?: boolean;
  suggestions?: string[];
  search_deeplink?: ChatAgentSearchDeeplink;
  has_more?: boolean;
};

export type StylistClientProfilePayload = {
  size?: string;
  favorite_colors?: string[];
  locale?: string;
};

export async function chatAgentTurn(payload: {
  user_id: string;
  thread_id?: string;
  text?: string;
  user_nav_node_id?: string;
  image_base64?: string;
  image_mime?: string;
  photo_mode?: "look_check" | "personal_style" | "find_similar";
  client_profile?: StylistClientProfilePayload;
}): Promise<ChatAgentTurnResponse> {
  return postJson<ChatAgentTurnResponse>("/chat/agent/turn", payload, false, {
    timeoutMs: 120_000,
    silent: true,
  });
}

export async function chatAgentFeedback(payload: {
  user_id: string;
  thread_id?: string;
  product_id: string;
  vote: "like" | "dislike";
}): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>("/chat/agent/feedback", payload, false, {
    timeoutMs: 15_000,
    silent: true,
  });
}

export type HomeExperience = {
  rule_id: string;
  rule_label?: string;
  personalized: boolean;
  algorithm_version?: string;
  banner: {
    tone: string;
    title: string;
    body: string;
    icon?: string;
  } | null;
  ctas: Array<{ id: string; label: string; href: string; variant: string }>;
  section_order: string[];
  catalog_hints?: Record<string, string>;
  highlight?: string | null;
  show_chat?: boolean;
  show_visual_search_first?: boolean;
  signals?: Record<string, unknown>;
};

export async function getHomeExperience(params: URLSearchParams) {
  return getJson<HomeExperience>(`/experience/home?${params.toString()}`, true, true);
}

export async function getMapStores(params?: {
  market_slug?: string;
}): Promise<import("@/lib/map-stores").MapStoresResponse> {
  const search = new URLSearchParams();
  if (params?.market_slug) search.set("market_slug", params.market_slug);
  const q = search.toString();
  return getJson<import("@/lib/map-stores").MapStoresResponse>(`/map/stores${q ? `?${q}` : ""}`, false);
}

export async function getFeaturedShops(params?: {
  market_slug?: string;
  ipadrom_id?: string;
}): Promise<{ items: ShopSummary[] }> {
  const search = new URLSearchParams();
  if (params?.market_slug) search.set("market_slug", params.market_slug);
  if (params?.ipadrom_id) search.set("ipadrom_id", params.ipadrom_id);
  const q = search.toString();
  return getJson<{ items: ShopSummary[] }>(`/shops/featured${q ? `?${q}` : ""}`, false);
}

export async function checkProductPrice(payload: {
  price_uzs: number;
  category?: string;
  product_name?: string;
}): Promise<{ flagged: boolean; message: string; median_uzs: number | null; ratio: number | null }> {
  return postJson("/moderation/check-price", payload);
}

export type ChatThreadItem = {
  id: string;
  shop_id: string;
  customer_key: string;
  customer_display_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessageItem = {
  id: string;
  thread_id: string;
  sender_role: "customer" | "merchant" | "system";
  body: string;
  created_at: string;
  metadata: Record<string, unknown>;
};

export async function createChatThread(payload: {
  shop_id: string;
  customer_key: string;
  customer_display_name?: string;
}): Promise<{ thread: ChatThreadItem }> {
  return postJson("/chat/threads", payload);
}

export async function getChatMessages(threadId: string): Promise<{ items: ChatMessageItem[] }> {
  return getJson(`/chat/threads/${threadId}/messages`, false);
}

export async function getShopDashboard(shopId: string): Promise<unknown> {
  return getJson(`/dashboard/shop/${shopId}`);
}

export type IndoorMarketMapResponse = {
  market_id: string;
  slug: string;
  name: string;
  source: "database" | "fixture";
  levels: Array<{
    level: number;
    name: string;
    view_box: string;
    navigation_graph: {
      nodes: Record<string, { id: string; x: number; y: number; kind: string }>;
      edges: Array<{ from: string; to: string; weight?: number }>;
    };
    stalls: Array<{
      id: string;
      stall_code: string;
      block_code: string;
      status: string;
      local_x: number;
      local_y: number;
      width: number;
      height: number;
      graph_node_id: string;
      shop_id?: string | null;
    }>;
  }>;
};

export async function getIndoorMarketMap(marketSlug: string): Promise<IndoorMarketMapResponse> {
  return getJson<IndoorMarketMapResponse>(`/indoor-maps/${marketSlug}`, false);
}

export type IndoorRouteResponse = {
  node_ids: string[];
  points: Array<{ x: number; y: number }>;
  distance: number;
  start_node_id?: string;
  goal_node_id?: string;
  origin?: { lat: number; lng: number };
};

export async function getIndoorRoute(
  marketSlug: string,
  level: number,
  startNodeId: string,
  goalNodeId: string,
): Promise<IndoorRouteResponse> {
  const params = new URLSearchParams({
    start_node_id: startNodeId,
    goal_node_id: goalNodeId,
  });
  return getJson(`/indoor-maps/${marketSlug}/levels/${level}/route?${params.toString()}`, false);
}

export async function getIndoorRouteFromCoordinates(
  marketSlug: string,
  level: number,
  payload: {
    goal_node_id: string;
    lat?: number;
    lng?: number;
    local_x?: number;
    local_y?: number;
    start_node_id?: string;
    order_id?: string;
    customer_phone?: string;
  },
): Promise<IndoorRouteResponse> {
  return postJson(`/indoor-maps/${marketSlug}/levels/${level}/route/from-coordinates`, payload, false);
}

export async function postOrderApproachPing(
  orderId: string,
  body: {
    phone?: string;
    lat?: number;
    lng?: number;
    local_x?: number;
    local_y?: number;
    market_slug?: string;
    level?: number;
  },
) {
  return postJson<{
    recorded: boolean;
    distance_label?: string;
    reason?: string;
    arrival_detected?: boolean;
    customer_message?: string | null;
    auto_completed?: boolean;
    order_status?: string;
  }>(`/orders/${orderId}/approach-ping`, body, true);
}
