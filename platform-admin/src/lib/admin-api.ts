"use client";

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type DashboardData = {
  counts: {
    pending_shops: number;
    pending_payouts: number;
    open_support_tickets: number;
  };
  profit: {
    earned_profit_uzs: number;
    held_escrow_uzs?: number;
    swept_pending_uzs: number;
    swept_completed_uzs: number;
    withdrawable_uzs: number;
    settlement_provider?: string;
    note?: string;
  };
  totals: {
    shops: number;
    active_shops: number;
    products: number;
    users: number;
    orders: number;
    pending_orders: number;
  };
  recent_orders: Array<{
    id: string;
    status: string;
    total_uzs: number;
    shop_id: string | null;
    created_at: string | null;
  }>;
};

export function getDashboard() {
  return adminFetch<DashboardData>("/admin/dashboard");
}

export function getPendingShops() {
  return adminFetch<{ items: ShopItem[]; count: number }>("/admin/shops/pending");
}

export type ShopItem = {
  id: string;
  name: string;
  slug?: string;
  owner_phone?: string | null;
  owner_display_name?: string | null;
  owner_email?: string | null;
  market_zone?: string | null;
  ipadrom_name?: string | null;
  verification_status?: string | null;
  verification_reason?: string | null;
  is_verified?: boolean;
  is_featured?: boolean;
  is_active?: boolean;
  is_blocked?: boolean;
  storefront_image_url?: string | null;
  logo_url?: string | null;
  floor?: string | null;
  section?: string | null;
  stall_number?: string | null;
  address_label?: string | null;
  description?: string | null;
  location_comment?: string | null;
  block_sector?: string | null;
  shop_type?: string | null;
  rating?: number;
  review_count?: number;
  product_count?: number;
  registration_source?: string | null;
  telegram_connected?: boolean;
  ai_reviewed_at?: string | null;
};

export function getShop(id: string) {
  return adminFetch<ShopItem>(`/admin/shops/${id}`);
}

export function getShops(opts?: { q?: string; verified?: boolean; offset?: number }) {
  const params = new URLSearchParams({ limit: "50" });
  if (opts?.q) params.set("q", opts.q);
  if (opts?.verified !== undefined) params.set("verified", String(opts.verified));
  if (opts?.offset) params.set("offset", String(opts.offset));
  return adminFetch<{ items: ShopItem[]; count: number; total: number }>(`/admin/shops?${params}`);
}

export function getShopShareKit(id: string) {
  return adminFetch<{
    shop_url?: string;
    qr_png_base64?: string;
    telegram_share_text?: string;
    crm_login_url?: string;
  }>(`/admin/shops/${id}/share-kit`);
}

export function setShopFeatured(id: string, featured: boolean, days = 30) {
  return adminFetch(`/admin/shops/${id}/featured`, {
    method: "PATCH",
    body: JSON.stringify({ featured, days }),
  });
}

export function verifyShop(id: string, verified: boolean, reason?: string) {
  return adminFetch(`/admin/shops/${id}/verify`, {
    method: "PATCH",
    body: JSON.stringify({ verified, reason }),
  });
}

export function rejectShop(id: string, reason: string) {
  return adminFetch(`/admin/shops/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export type PayoutItem = {
  id: string;
  shop_id: string;
  shop_name?: string | null;
  amount_uzs: number;
  status: string;
  destination?: string | null;
  created_at?: string | null;
};

export function getPendingPayouts() {
  return adminFetch<{ items: PayoutItem[]; count: number; total_pending_uzs?: number }>(
    "/admin/payouts/pending",
  );
}

export type IncomingPayment = {
  id: string;
  order_id?: string | null;
  shop_id?: string | null;
  shop_name?: string | null;
  customer_phone?: string | null;
  amount_uzs: number;
  platform_commission_uzs?: number | null;
  merchant_share_uzs?: number | null;
  provider?: string | null;
  reference?: string | null;
  status: string;
  paid_at?: string | null;
};

export function getIncomingPayments(days = 30, status?: string) {
  const params = new URLSearchParams({ days: String(days), limit: "100" });
  if (status) params.set("status", status);
  return adminFetch<{
    items: IncomingPayment[];
    count: number;
    summary: {
      days: number;
      payments: number;
      total_incoming_uzs: number;
      platform_commission_uzs: number;
    };
  }>(`/admin/payments/incoming?${params}`);
}

export function completePayout(id: string, reference?: string) {
  return adminFetch(`/admin/payouts/${id}/complete`, {
    method: "POST",
    body: JSON.stringify({ reference }),
  });
}

export function rejectPayout(id: string, note?: string) {
  return adminFetch(`/admin/payouts/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export function getPlatformProfit() {
  return adminFetch<DashboardData["profit"]>("/admin/platform-profit");
}

export function getProfitSweeps() {
  return adminFetch<{ items: SweepItem[] }>("/admin/platform-profit/sweeps");
}

export type SweepItem = {
  id: string;
  amount_uzs: number;
  status: string;
  reference?: string | null;
  created_at?: string | null;
  processed_at?: string | null;
};

export function createSweep(amount_uzs: number, note?: string) {
  return adminFetch("/admin/platform-profit/sweep", {
    method: "POST",
    body: JSON.stringify({ amount_uzs, note }),
  });
}

export function completeSweep(id: string, reference?: string) {
  return adminFetch(`/admin/platform-profit/sweeps/${id}/complete`, {
    method: "POST",
    body: JSON.stringify({ reference }),
  });
}

export type MarketAnalytics = {
  market_slug: string;
  days: number;
  block_footfall: Array<{ block: string; hits: number; intensity: number }>;
  top_searches: Array<{ query: string; count: number }>;
  total_routes: number;
  total_searches: number;
};

export type AnalyticsOverview = {
  days: number;
  market_slug: string;
  summary: {
    orders: number;
    revenue_uzs: number;
    new_users: number;
    avg_order_uzs: number;
    platform_profit_uzs: number;
    total_routes: number;
    total_searches: number;
  };
  orders_series: Array<{ date: string; orders: number; revenue_uzs: number }>;
  users_series: Array<{ date: string; users: number }>;
  orders_by_status: Array<{ status: string; count: number }>;
  top_shops: Array<{ shop_id: string; shop_name: string; orders: number; revenue_uzs: number }>;
  market: MarketAnalytics;
};

export function getAnalyticsOverview(days = 7, marketSlug = "ippodrom") {
  return adminFetch<AnalyticsOverview>(
    `/admin/analytics/overview?days=${days}&market_slug=${encodeURIComponent(marketSlug)}`,
  );
}

export function getMarketAnalytics(slug: string, days = 7) {
  return adminFetch<MarketAnalytics>(`/admin/analytics/markets/${slug}?days=${days}`);
}

export function getSupportTickets(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return adminFetch<{ items: TicketItem[]; count: number }>(`/admin/support/tickets${q}`);
}

export type TicketItem = {
  id: string;
  shop_name?: string | null;
  category: string;
  message: string;
  status: string;
  admin_note?: string | null;
  merchant_phone?: string | null;
  created_at?: string | null;
};

export function updateTicket(id: string, body: { status?: string; admin_note?: string }) {
  return adminFetch(`/admin/support/tickets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function getOrders(opts?: { status?: string; q?: string; offset?: number }) {
  const params = new URLSearchParams({ limit: "50" });
  if (opts?.status) params.set("status", opts.status);
  if (opts?.q) params.set("q", opts.q);
  if (opts?.offset) params.set("offset", String(opts.offset));
  return adminFetch<{ items: OrderItem[]; count: number; total: number }>(`/admin/orders?${params}`);
}

export function getOrder(id: string) {
  return adminFetch<OrderDetail>(`/admin/orders/${id}`);
}

export type OrderItem = {
  id: string;
  status: string;
  total_uzs: number;
  shop_id: string | null;
  shop_name?: string | null;
  user_id: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  payment_method?: string | null;
  fulfillment_type?: string | null;
  created_at: string | null;
};

export type OrderDetail = OrderItem & {
  quantity?: number;
  product_name?: string | null;
  delivery_address?: string | null;
  delivery_cost_uzs?: number | null;
  note?: string | null;
  updated_at?: string | null;
};

export function getUsers(opts?: { q?: string; offset?: number }) {
  const params = new URLSearchParams({ limit: "50" });
  if (opts?.q) params.set("q", opts.q);
  if (opts?.offset) params.set("offset", String(opts.offset));
  return adminFetch<{ items: UserItem[]; count: number; total: number }>(`/admin/users?${params}`);
}

export type UserItem = {
  id: string;
  phone?: string | null;
  email?: string | null;
  telegram_id?: number | null;
  full_name?: string | null;
  role?: string | null;
  created_at?: string | null;
};

export type PremiumTariff = {
  id: string;
  code: string;
  name_uz: string;
  priority_weight: number;
  dwell_ms: number;
  badge_label?: string | null;
  frame_style?: string;
  price_uzs_monthly?: number | null;
  coin_cost?: number | null;
  duration_days?: number;
  is_active: boolean;
};

export type PremiumBanner = {
  id: string;
  shop_id: string;
  shop_name: string;
  shop_slug?: string;
  rating?: number;
  image_url: string;
  headline: string;
  tariff_code: string;
  tariff_label: string;
  cta_url: string;
  status?: string;
  is_active?: boolean;
  ends_at?: string | null;
  created_at?: string | null;
};

export function getPremiumBanners(activeOnly = false) {
  const q = activeOnly ? "?active_only=true" : "";
  return adminFetch<{ items: PremiumBanner[] }>(`/admin/premium/banners${q}`);
}

export function getPremiumTariffs() {
  return adminFetch<{ items: PremiumTariff[] }>("/admin/premium/tariffs");
}

export function updatePremiumTariff(
  id: string,
  body: Partial<{
    name_uz: string;
    priority_weight: number;
    dwell_ms: number;
    badge_label: string | null;
    price_uzs_monthly: number;
    coin_cost: number;
    duration_days: number;
    is_active: boolean;
  }>,
) {
  return adminFetch<PremiumTariff>(`/admin/premium/tariffs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function uploadPremiumBannerImage(shopId: string, file: File) {
  const form = new FormData();
  form.append("shop_id", shopId);
  form.append("file", file);
  const res = await fetch("/api/v1/admin/premium/upload-image", {
    method: "POST",
    body: form,
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ image_url: string; width: number; height: number }>;
}

export function createPremiumBanner(body: {
  shop_id: string;
  tariff_code: string;
  image_url: string;
  title?: string;
  days?: number;
}) {
  return adminFetch("/admin/premium/banners", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deactivatePremiumBanner(id: string) {
  return adminFetch<{ status: string; id: string }>(`/admin/premium/banners/${id}/deactivate`, {
    method: "PATCH",
  });
}

// --- Do'kon qarzi (debt) ---------------------------------------------------

export type ShopDebtStatus = {
  shop_id: string;
  debt_balance_uzs: number;
  is_blocked: boolean;
  block_threshold_uzs: number;
  amount_until_block_uzs: number;
  markup_pct: number;
};

export function getShopDebt(shopId: string) {
  return adminFetch<ShopDebtStatus>(`/admin/shops/${shopId}/debt`);
}

export function clearShopDebt(shopId: string, amount_uzs: number, note?: string) {
  return adminFetch(`/admin/shops/${shopId}/clear-debt`, {
    method: "POST",
    body: JSON.stringify({ amount_uzs, note }),
  });
}

// --- Pending mahsulotlar (moderatsiya) ------------------------------------

export type PendingProductItem = {
  id: string;
  shop_id: string;
  shop_name?: string | null;
  status: string;
  vision_attributes?: Record<string, unknown>;
  moderation_reason?: string | null;
  created_at?: string | null;
};

export function getPendingProducts(opts?: { offset?: number }) {
  const params = new URLSearchParams({ limit: "50" });
  if (opts?.offset) params.set("offset", String(opts.offset));
  return adminFetch<{ items: PendingProductItem[]; count: number; total: number }>(
    `/admin/products/pending?${params}`,
  );
}

// --- Business rules -------------------------------------------------------

export type BusinessRule = {
  id: string;
  rule_key: string;
  rule_value: string;
  scope: string;
  scope_ref_id?: string | null;
  is_active: boolean;
  description?: string | null;
};

export function getBusinessRules() {
  return adminFetch<{ items: BusinessRule[] }>("/admin/business-rules").catch(() =>
    adminFetch<{ items: BusinessRule[] }>("/crm/business-rules"),
  );
}

export function upsertBusinessRule(body: {
  rule_key: string;
  rule_value: string;
  scope?: string;
  is_active?: boolean;
  description?: string | null;
}) {
  // Try admin endpoint first, fallback to crm endpoint
  return adminFetch<{ status: string; id: string; rule_key?: string }>("/admin/business-rules", {
    method: "POST",
    body: JSON.stringify(body),
  }).catch(() =>
    adminFetch<{ status: string; id: string; rule_key?: string }>("/crm/business-rules", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

export function deleteBusinessRule(id: string) {
  return adminFetch<{ status: string; id: string }>(`/admin/business-rules/${id}`, {
    method: "DELETE",
  });
}

// --- Broadcast ------------------------------------------------------------

export function sendBroadcast(body: { title: string; body: string; target?: string }) {
  return adminFetch<{ status: string; sent: number; total: number; target: string }>(
    "/admin/broadcast",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}
