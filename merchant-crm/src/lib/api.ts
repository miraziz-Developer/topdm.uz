import { authHeaders } from "@/lib/auth";
import { resolveApiBase } from "@/lib/http-client";

function apiUrl(path: string): string {
  return `${resolveApiBase()}${path}`;
}

async function parseError(response: Response): Promise<string> {
  const detail = await response.text().catch(() => "");
  if (!detail) return `API error: ${response.status}`;
  try {
    const json = JSON.parse(detail) as {
      detail?: string | { message?: string; code?: string };
      error?: string | { message?: string; code?: string };
    };
    const d = json.detail ?? json.error;
    if (typeof d === "string") return `API error: ${response.status} — ${d}`;
    if (d && typeof d === "object") {
      if (typeof d.message === "string") return d.message;
      if (typeof d.code === "string") return d.code;
    }
  } catch {
    /* plain text */
  }
  return `API error: ${response.status} — ${detail.slice(0, 200)}`;
}

export async function postJson<TResponse>(path: string, body: unknown, auth = false): Promise<TResponse> {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? authHeaders() : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<TResponse>;
}

export async function getJson<TResponse>(path: string, auth = true): Promise<TResponse> {
  const response = await fetch(apiUrl(path), {
    method: "GET",
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<TResponse>;
}

export async function patchJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const response = await fetch(apiUrl(path), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<TResponse>;
}

export async function deleteJson<TResponse>(path: string): Promise<TResponse> {
  const response = await fetch(apiUrl(path), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<TResponse>;
}

export async function postFormData<TResponse>(path: string, form: FormData, auth = true): Promise<TResponse> {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: auth ? authHeaders() : {},
    body: form,
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<TResponse>;
}

export type MerchantShopProfile = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logo_url?: string | null;
  storefront_image_url?: string | null;
  floor?: string | null;
  section?: string | null;
  is_verified?: boolean;
  shop_type?: string | null;
};

export async function getMerchantMe() {
  return getJson<{
    email: string | null;
    phone: string | null;
    shop: MerchantShopProfile;
  }>("/merchant/me");
}

export async function patchMerchantShopProfile(body: { description?: string | null }) {
  return patchJson<{ shop: MerchantShopProfile }>("/merchant/shop/profile", body);
}

export async function uploadMerchantShopLogo(file: File) {
  const form = new FormData();
  form.append("file", file);
  return postFormData<{ shop: MerchantShopProfile }>("/merchant/shop/logo", form);
}

export async function uploadMerchantShopCover(file: File) {
  const form = new FormData();
  form.append("file", file);
  return postFormData<{ shop: MerchantShopProfile }>("/merchant/shop/cover", form);
}

export type MerchantStoryItem = {
  id: string;
  shop_id: string;
  image_url: string;
  level_context: string;
  created_at: string;
  expires_at: string;
  is_hot: boolean;
};

export async function uploadMerchantStory(file: File) {
  const form = new FormData();
  form.append("file", file);
  return postFormData<{ item: MerchantStoryItem }>("/merchants/stories", form);
}

export async function listMerchantStories() {
  return getJson<{ items: MerchantStoryItem[] }>("/merchants/stories", true);
}

export async function deleteMerchantStory(storyId: string) {
  return deleteJson<{ story_id: string; deleted: boolean }>(`/merchants/stories/${storyId}`);
}

export async function getMerchantDashboard() {
  return getJson<{
    stats: { total_products: number; total_leads: number; total_views: number; total_visits: number };
    leads: Array<{ id: string; customer_phone: string; customer_name?: string; status: string }>;
    orders: Array<{
      id: string;
      status: string;
      total_price: number;
      quantity: number;
      product_name: string;
      fulfillment_type?: string;
      carrier_class?: "express" | "cargo" | null;
      delivery_cost_uzs?: number | null;
      delivery_eta_minutes?: number | null;
      delivery_address?: string | null;
      customer_phone?: string;
      pickup_date?: string | null;
      pickup_time?: string | null;
      arrival_status?: string | null;
      dwell_minutes?: number | null;
      distance_label?: string | null;
    }>;
  }>("/merchant/dashboard");
}

export type VariantCatalogPayload = {
  all_sizes: string[];
  colors: Array<{ name: string; sizes: string[]; image_urls: string[] }>;
  sku_stock: Record<string, number>;
  fallback_stock?: number;
};

export type MerchantProduct = {
  id: string;
  name: string;
  price: number;
  description?: string | null;
  images: string[];
  is_featured: boolean;
  is_available: boolean;
  stock_count: number;
  view_count: number;
  sale_type?: string;
  attributes?: Record<string, unknown>;
  variant_catalog?: VariantCatalogPayload;
};

export async function getMerchantProducts(includeHidden = true) {
  return getJson<{ items: MerchantProduct[] }>(
    `/merchant/products?include_hidden=${includeHidden ? "true" : "false"}`,
  );
}

export async function getMerchantProduct(productId: string) {
  return getJson<{ item: MerchantProduct }>(`/merchant/products/${productId}`);
}

export async function createMerchantProduct(input: {
  files: File[];
  imageMeta?: (string | null)[];
  name: string;
  price: number;
  description?: string;
  stock_count?: number;
  is_featured?: boolean;
  variantCatalog?: VariantCatalogPayload;
  wholesale?: Record<string, string>;
}) {
  const form = new FormData();
  for (const file of input.files) {
    form.append("files", file);
  }
  form.append("name", input.name);
  form.append("price", String(input.price));
  if (input.description) form.append("description", input.description);
  form.append("stock_count", String(input.stock_count ?? 5));
  form.append("is_featured", input.is_featured ? "true" : "false");
  if (input.variantCatalog) {
    form.append("variant_json", JSON.stringify(input.variantCatalog));
  }
  if (input.imageMeta?.length) {
    form.append("image_meta", JSON.stringify(input.imageMeta));
  }
  if (input.wholesale) {
    for (const [key, value] of Object.entries(input.wholesale)) {
      form.append(key, value);
    }
  }
  return postFormData<{ item: MerchantProduct }>("/merchant/products", form);
}

export async function updateMerchantProduct(
  productId: string,
  body: {
    name?: string;
    price?: number;
    description?: string | null;
    stock_count?: number;
    is_available?: boolean;
    is_featured?: boolean;
    variant_catalog?: VariantCatalogPayload;
  },
) {
  return patchJson<{ item: MerchantProduct }>(`/merchant/products/${productId}`, body);
}

export async function uploadMerchantProductImages(
  productId: string,
  items: Array<{ file: File; color?: string | null }>,
) {
  const form = new FormData();
  const meta: (string | null)[] = [];
  for (const item of items) {
    form.append("files", item.file);
    meta.push(item.color?.trim() || null);
  }
  form.append("image_meta", JSON.stringify(meta));
  return postFormData<{ item: MerchantProduct }>(`/merchant/products/${productId}/images`, form);
}

export async function uploadMerchantProductImage(productId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return postFormData<{ item: MerchantProduct }>(`/merchant/products/${productId}/image`, form);
}

export async function deleteMerchantProduct(productId: string) {
  return deleteJson<{ product_id: string; deleted: boolean }>(`/merchant/products/${productId}`);
}

export type ReportedReelsComment = {
  comment_id: string;
  video_id: string;
  text: string;
  reported_count: number;
  is_deleted: boolean;
  created_at?: string | null;
};

export async function getMerchantReportedReelsComments(limit = 50) {
  return getJson<{ items: ReportedReelsComment[] }>(`/reels/merchant/comments/reported?limit=${limit}`);
}

export async function moderateMerchantReelsComment(commentId: string, action: "hide" | "restore") {
  return postJson<{ ok: boolean; is_deleted: boolean }>(`/reels/merchant/comments/${commentId}/moderate`, { action });
}

export async function setProductFeatured(productId: string, featured: boolean) {
  return patchJson<{ product_id: string; is_featured: boolean }>(`/merchant/products/${productId}/featured`, {
    featured,
  });
}

export async function getMerchantHeatmap(marketSlug: string, level = 1, days = 30) {
  return getJson<{
    market_slug: string;
    level: number;
    days: number;
    nodes: Array<{ node_id: string; hits: number; intensity: number }>;
    stalls: Array<{
      stall_id: string;
      graph_node_id: string;
      block_code: string;
      stall_code: string;
      intensity: number;
    }>;
    total_routes: number;
  }>(`/merchant/analytics/heatmap?market_slug=${marketSlug}&level=${level}&days=${days}`);
}

export async function getWorkspaceDraft() {
  return getJson<{ draft: Record<string, unknown> }>("/merchant/workspace-draft");
}

export async function patchWorkspaceDraft(body: Record<string, unknown>) {
  return patchJson<{ draft: Record<string, unknown>; autosaved: boolean }>("/merchant/workspace-draft", body);
}

export async function getRouteHeatmap(marketSlug: string, level = 1, days = 30) {
  return getJson<{
    market_slug: string;
    level: number;
    days: number;
    nodes: Array<{ node_id: string; hits: number; intensity: number }>;
    stalls: Array<{
      stall_id: string;
      graph_node_id: string;
      block_code: string;
      stall_code: string;
      intensity: number;
    }>;
  }>(`/indoor-maps/${marketSlug}/heatmap?level=${level}&days=${days}`, false);
}

export async function getIndoorMarketMap(marketSlug: string) {
  return getJson<{
    levels: Array<{
      level: number;
      name: string;
      view_box: string;
      navigation_graph?: { nodes?: Record<string, { x?: number; y?: number; kind?: string }>; edges?: unknown[] };
      stalls: Array<{
        id: string;
        stall_code: string;
        block_code: string;
        status: string;
        local_x: number;
        local_y: number;
        width: number;
        height: number;
        graph_node_id?: string;
        shop_id?: string | null;
      }>;
    }>;
  }>(`/indoor-maps/${marketSlug}`, false);
}

export async function updateMerchantIndoorStallPosition(
  stallId: string,
  localX: number,
  localY: number,
  options?: { snapToNearestNode?: boolean; graphNodeId?: string | null },
) {
  return patchJson(`/merchant/indoor-stalls/${stallId}/position`, {
    local_x: localX,
    local_y: localY,
    snap_to_nearest_node: options?.snapToNearestNode ?? true,
    graph_node_id: options?.graphNodeId ?? null,
  });
}

export async function getMarketGeofenceBoundary(marketSlug: string) {
  return getJson<{
    market_slug: string;
    geofence: {
      center?: { lat: number; lng: number };
      radius_m?: number;
      polygon?: Array<{ lat: number; lng: number }>;
    };
  }>(`/indoor-maps/${marketSlug}/geofence`, false);
}

export async function checkMarketGeofence(marketSlug: string, latitude: number, longitude: number) {
  return postJson<{
    inside: boolean;
    distance_m?: number;
    accuracy_target_m: number;
    pin: { x: number; y: number };
    message?: string | null;
  }>(`/indoor-maps/${marketSlug}/geofence/check`, { lat: latitude, lng: longitude }, false);
}

export async function saveMerchantPrecisionLocation(payload: {
  market_slug: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  floor: string;
  block: string;
  stall: string;
  comment: string;
  indoor_pin_x: number;
  indoor_pin_y: number;
}) {
  return postJson("/merchant/precision-location", payload);
}

export type PendingProductItem = {
  id: string;
  shop_id: string;
  status: string;
  moderation_reason?: string | null;
  telegram_file_id?: string | null;
  vision_attributes: Record<string, unknown>;
  published_product_id?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export async function listPendingProducts(status = "pending") {
  return getJson<{ items: PendingProductItem[] }>(`/merchant/pending-products?status=${encodeURIComponent(status)}`);
}

export async function publishPendingProduct(
  pendingId: string,
  body: { name?: string; price_uzs?: number; description?: string },
) {
  return postJson<{ pending_id: string; product_id: string; product_name: string; image_url?: string; status: string }>(
    `/merchant/pending-products/${pendingId}/publish`,
    body,
  );
}

export async function rejectPendingProduct(pendingId: string, body: { reason: string }) {
  return postJson<{ item: PendingProductItem }>(`/merchant/pending-products/${pendingId}/reject`, body);
}

export async function editPendingProduct(
  pendingId: string,
  body: { name?: string; price_uzs?: number; description?: string },
) {
  return patchJson<{ item: PendingProductItem }>(`/merchant/pending-products/${pendingId}`, body);
}

export type ChatThreadSummary = {
  id: string;
  shop_id: string;
  customer_key: string;
  customer_display_name?: string | null;
  status: string;
  updated_at: string;
  last_message?: string | null;
  last_sender_role?: string | null;
};

export type ChatMessageItem = {
  id: string;
  thread_id: string;
  sender_role: "customer" | "merchant" | "system";
  body: string;
  created_at: string;
  metadata: Record<string, unknown>;
};

export async function listMerchantChatThreads() {
  return getJson<{ items: ChatThreadSummary[] }>("/merchant/chat/threads");
}

export async function getMerchantChatMessages(threadId: string) {
  return getJson<{ items: ChatMessageItem[] }>(`/merchant/chat/threads/${threadId}/messages`);
}

export async function updateMerchantOrder(orderId: string, status: string) {
  return patchJson<{ order_id: string; status: string }>(`/merchant/orders/${orderId}`, { status });
}

export async function dispatchMerchantCourier(orderId: string) {
  return postJson<{
    order_id: string;
    claim_id: string;
    yandex_claim_id?: string;
    status: string;
  }>(`/merchant/orders/${orderId}/dispatch-courier`, {});
}

export async function syncMerchantDelivery(orderId: string) {
  return postJson<{ order_id: string; status: string }>(`/merchant/orders/${orderId}/sync-delivery`, {});
}

export async function getMerchantWaybill(orderId: string) {
  return getJson<{
    order_id: string;
    barcode_value: string;
    merchant: { name: string; sector: string; block: string; rasta: string; phone: string };
    customer: { phone: string; address: string; city: string };
    carrier_class: string;
    delivery_cost_uzs: number;
    claim_status: string;
    yandex_claim_id?: string | null;
  }>(`/merchant/orders/${orderId}/waybill`);
}

export async function getMerchantFinanceWallet() {
  return getJson<{ shop_id: string; wallet: { current_balance: string; frozen_balance: string } }>("/merchant/finance/wallet");
}

export async function requestMerchantPayout(payload: {
  amount_uzs: number;
  card_number: string;
  destination?: string;
}) {
  return postJson<{
    payout_id: string;
    amount_uzs: number;
    status: string;
    wallet: { current_balance: string; frozen_balance: string };
  }>("/merchant/finance/payout-request", {
    amount_uzs: payload.amount_uzs,
    card_number: payload.card_number,
    destination: payload.destination ?? "bank_card",
  });
}

export async function confirmMerchantPickup(orderId: string, note?: string) {
  return postJson<{ order_id: string; status: string; completed_at: string; source: string }>(
    `/merchant/orders/${orderId}/confirm-pickup`,
    { note },
  );
}

export async function getMerchantPickupSettings() {
  return getJson<{
    settings: {
      notify_on_arrival: boolean;
      auto_complete_enabled: boolean;
      auto_complete_after_minutes: number;
      shop_arrival_radius_m: number;
    };
  }>("/merchant/pickup-settings");
}

export async function patchMerchantPickupSettings(body: {
  notify_on_arrival?: boolean;
  auto_complete_enabled?: boolean;
  auto_complete_after_minutes?: number;
  shop_arrival_radius_m?: number;
}) {
  return patchJson<{ settings: Awaited<ReturnType<typeof getMerchantPickupSettings>>["settings"] }>(
    "/merchant/pickup-settings",
    body,
  );
}

export async function updateMerchantLead(leadId: string, status: string, note?: string) {
  return patchJson<{ lead_id: string; status: string }>(`/merchant/leads/${leadId}`, { status, note });
}

export type CrmTariff = {
  code: string;
  name_uz: string;
  duration_days: number;
  reference_days?: number;
  reference_price_uzs?: number;
  price_per_day_uzs?: number;
  carousel_slot?: number;
  priority_weight?: number;
  day_options?: number[];
  placement?: string;
  price_uzs: number | null;
  badge_label: string | null;
};

export type CrmBannerCampaign = {
  id: string;
  status: string;
  title: string | null;
  image_url: string;
  tariff_code: string;
  tariff_label: string;
  seconds_remaining: number;
  impressions_count: number;
  clicks_count: number;
  ctr_percent: number;
  is_active: boolean;
};

export type MerchantWallet = {
  shop_id: string;
  balance_uzs: number;
  coin_balance?: number;
  coins_balance?: number;
};

export async function getCrmBannerTariffs() {
  return getJson<{ items: CrmTariff[] }>("/crm/banners/tariffs");
}

export async function getCrmMerchantWallet() {
  return getJson<MerchantWallet>("/crm/banners/wallet");
}

export async function getCrmMyBanners() {
  return getJson<{ items: CrmBannerCampaign[] }>("/crm/banners/mine");
}

export async function buyCrmBannerWithCoins(payload: {
  title?: string;
  tariff_code: string;
  duration_days?: number;
  image: File;
}) {
  const form = new FormData();
  if (payload.title) form.append("title", payload.title);
  form.append("tariff_code", payload.tariff_code);
  form.append("duration_days", String(payload.duration_days ?? 30));
  form.append("image", payload.image);
  return postFormData<{ banner_id: string; status: string; balance_uzs: number; amount_uzs?: number }>(
    "/crm/banners/buy-with-coins",
    form,
  );
}

export async function renewCrmBanner(payload: {
  banner_id: string;
  tariff_code?: string;
  duration_days?: number;
}) {
  return postJson<{ banner_id: string; status: string }>("/crm/banners/renew", payload);
}

export type CoinPackage = {
  id: string;
  code: string;
  name_uz: string;
  coins: number;
  amount_uzs: number;
};

export async function getCoinPackages() {
  return getJson<{ items: CoinPackage[] }>("/payments/coin-packages");
}

export async function generateCoinTopUpInvoice(payload: {
  coin_package_id: string;
  provider: "click";
}) {
  return postJson<{
    transaction_id: string;
    checkout_url: string;
    status: string;
    coins_added: number;
    amount_uzs: number;
    package: { id: string; code: string; name_uz: string };
  }>("/payments/generate-invoice", payload);
}

export type TodayTask = {
  type: string;
  priority: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export async function getMerchantToday() {
  return getJson<{
    generated_at: string;
    shop_verified: boolean;
    counts: Record<string, number>;
    tasks: TodayTask[];
    alerts: Array<{ type: string; title: string; body: string; at?: string }>;
  }>("/merchant/today");
}

export async function getMerchantAnalyticsSummary(days = 7) {
  return getJson<{
    days: number;
    granularity?: "day" | "week" | "month";
    period_label?: string;
    daily_series: Array<{
      date: string;
      label?: string;
      views: number;
      leads: number;
      orders: number;
      map_routes: number;
    }>;
    totals: Record<string, number>;
    top_products: Array<{ id: string; name: string; price: number; view_count: number; lead_count: number }>;
    conversion_hint: string;
  }>(`/merchant/analytics/summary?days=${days}`);
}

export async function getCustomerHistory(phone: string) {
  return getJson<{
    phone: string;
    is_returning_customer: boolean;
    total_leads: number;
    total_orders: number;
    leads: Array<{ id: string; status: string; customer_name?: string }>;
    orders: Array<{ id: string; status: string; total_price: number; quantity: number }>;
  }>(`/merchant/customers/history?phone=${encodeURIComponent(phone)}`);
}

export type ShareMessageTemplate = {
  id: string;
  label: string;
  text: string;
};

export type MerchantShareKit = {
  shop_id: string;
  shop_name: string;
  shop_url: string;
  shop_url_qr?: string;
  shop_slug: string;
  qr_caption?: string;
  location_line: string;
  hours_line: string;
  operating_hours: { open: string; close: string; busy_note: string };
  telegram_bot_link: string;
  whatsapp_share_url: string;
  telegram_share_url: string;
  qr_image_url: string;
  qr_download_url: string;
  qr_poster_url?: string;
  copy_lines: string[];
  share_messages: ShareMessageTemplate[];
  default_message: string;
};

export async function getMerchantShareKit() {
  return getJson<MerchantShareKit>("/merchant/share-kit");
}

export type IncomingVisitor = {
  order_id: string;
  customer_label: string;
  product_name?: string;
  order_status?: string;
  pickup_date?: string | null;
  pickup_time?: string | null;
  distance_m?: number;
  distance_band?: string;
  distance_label?: string;
  inside_market?: boolean;
  map_x?: number | null;
  map_y?: number | null;
  updated_at?: string;
  privacy_note?: string;
  note?: string;
  arrival_status?: string | null;
  dwell_minutes?: number | null;
};

export async function getIncomingVisitors() {
  return getJson<{
    settings: {
      enabled: boolean;
      alert_radius_km: number;
      show_on_map: boolean;
      max_alert_radius_km?: number;
    };
    visitors: IncomingVisitor[];
    reserved_without_location: IncomingVisitor[];
    updated_at: string;
  }>("/merchant/incoming-visitors");
}

export async function getMerchantApproachSettings() {
  return getJson<{
    settings: { enabled: boolean; alert_radius_km: number; show_on_map: boolean; max_alert_radius_km?: number };
  }>("/merchant/approach-settings");
}

export async function patchMerchantApproachSettings(body: {
  enabled?: boolean;
  show_on_map?: boolean;
  alert_radius_km?: number;
}) {
  return patchJson<{
    settings: { enabled: boolean; alert_radius_km: number; show_on_map: boolean; max_alert_radius_km?: number };
  }>("/merchant/approach-settings", body);
}

export async function getChatQuickReplies() {
  return getJson<{ items: Array<{ id: string; label: string; text: string }> }>("/merchant/chat/quick-replies");
}

export async function bulkDiscountProducts(percentOff: number, productIds?: string[]) {
  return postJson<{ updated: number; percent_off: number }>("/merchant/products/bulk-discount", {
    percent_off: percentOff,
    product_ids: productIds?.length ? productIds : null,
  });
}

export async function restockNotifyProduct(productId: string, message?: string) {
  return postJson<{ lead_count: number; sample_phones: string[]; message_template: string }>(
    `/merchant/products/${productId}/restock-notify`,
    { message },
  );
}

export async function getOperatingHours() {
  return getJson<{ operating_hours: { open: string; close: string; busy_note: string } }>(
    "/merchant/operating-hours",
  );
}

export async function patchOperatingHours(hours: { open: string; close: string; busy_note: string }) {
  return patchJson<{ operating_hours: typeof hours }>("/merchant/operating-hours", hours);
}

export async function getCrmShopTrust() {
  return getJson<{
    store_rating_metrics: {
      average_rating: number;
      total_reviews_count: number;
      order_fulfillment_rate: number;
      product_match_rate: number;
      average_response_time_min: number;
    };
    store_reviews: Array<{ id: string; rating: number; comment?: string }>;
    trust_metrics: Record<string, unknown>;
  }>("/crm/shop/trust");
}

export type SupplierBrief = {
  shop_id: string;
  name: string;
  slug: string;
  product_count: number;
};

export type SupplierProductBrief = {
  id: string;
  name: string;
  price: number;
  image_url?: string | null;
  stock_count?: number;
};

export async function getSalesReportCard(period: "week" | "month" = "week") {
  return getJson<{
    period: string;
    period_label: string;
    shop_name: string;
    orders_count: number;
    revenue_uzs: number;
    growth_pct: number;
    headline: string;
    share_text: string;
    shop_url: string;
    telegram_share_url: string;
  }>(`/merchant/growth/sales-report-card?period=${period}`);
}

export async function getReferralPanel() {
  return getJson<{
    referral_code: string;
    referral_link: string;
    reward_coins_each: number;
    referred_shops: number;
    rewarded_shops: number;
    share_text: string;
  }>("/merchant/growth/referral");
}

export async function listSuppliers() {
  return getJson<{ items: SupplierBrief[] }>("/merchant/growth/suppliers");
}

export async function linkSupplier(supplierSlug: string) {
  return postJson<{ status: string }>("/merchant/growth/suppliers/link", { supplier_slug: supplierSlug });
}

export async function getSupplierProducts(supplierShopId: string) {
  return getJson<{ items: SupplierProductBrief[] }>(`/merchant/growth/suppliers/${supplierShopId}/products`);
}

export async function importSupplierProduct(productId: string) {
  return postJson<{ product_id: string; name: string }>(`/merchant/growth/suppliers/import/${productId}`, {});
}

export async function patchMerchantQuickReplies(
  custom: Array<{ id?: string; label: string; text: string }>,
) {
  return patchJson<{ items: Array<{ id: string; label: string; text: string; custom?: boolean }> }>(
    "/merchant/chat/quick-replies",
    { custom },
  );
}

export async function scanMerchantPickupQr(token: string) {
  return postJson<{
    order_id: string;
    status: string;
    already_completed: boolean;
    quantity: number;
    total_price: number;
    customer_phone: string;
    payment_method?: string | null;
    pickup_date?: string | null;
    pickup_time?: string | null;
    product: { id: string; name: string; price: number };
    shop: { id: string; name: string };
  }>("/merchant/pickup/scan", { token });
}

export type CrmReviewRow = {
  id: string;
  product_id: string;
  author_name: string;
  rating: number;
  body?: string | null;
  photo_urls?: string[];
  is_verified_purchase?: boolean;
  status?: string;
  created_at?: string | null;
};

export async function getCrmReviews(status = "pending_moderation") {
  return getJson<{ items: CrmReviewRow[]; status: string }>(
    `/crm/reviews?status=${encodeURIComponent(status)}`,
  );
}

export async function moderateCrmReview(reviewId: string, action: "approve" | "reject", note?: string) {
  return postJson<{ review: CrmReviewRow }>(`/crm/reviews/${reviewId}/action`, { action, note });
}
