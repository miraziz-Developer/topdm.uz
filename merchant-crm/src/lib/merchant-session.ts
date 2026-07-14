import { clearAccessToken, getAccessToken, setAccessToken } from "@/lib/auth";
import { resolveApiBase } from "@/lib/http-client";
import { getTelegramWebApp, getWebAppInitData, waitForWebAppInitData } from "@/lib/telegram-webapp";

function apiUrl(path: string): string {
  return `${resolveApiBase()}${path}`;
}

function resolveShopIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("shop_id");
}

/**
 * BUG FIX: JWT exp ni decode qilib tekshiradi — network so'rovsiz.
 * Muddati o'tgan bo'lsa false, hali amal qilsa true qaytaradi.
 */
function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const exp = payload.exp as number | undefined;
    if (!exp) return false; // exp yo'q bo'lsa — cheksiz
    // 30 soniya buffer qo'shamiz
    return Date.now() / 1000 > exp - 30;
  } catch {
    return true;
  }
}

async function probeMerchantMe(token: string): Promise<boolean> {
  const response = await fetch(apiUrl("/merchant/me"), {
    method: "GET",
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.ok;
}

/** JWT hali amal qiladimi — avval exp tekshiriladi, keyin network. */
export async function isMerchantTokenValid(token?: string | null): Promise<boolean> {
  const candidate = token ?? getAccessToken();
  if (!candidate) return false;
  // BUG FIX: Muddati o'tgan bo'lsa network so'rovsiz false
  if (isJwtExpired(candidate)) return false;
  return probeMerchantMe(candidate);
}

/**
 * Amal qiladigan token qaytaradi: mavjud JWT, Telegram yangilash yoki null.
 * Muddati o'tgan token localStorage dan o'chiriladi.
 */
export async function resolveMerchantSession(options?: {
  allowTelegramRefresh?: boolean;
}): Promise<string | null> {
  const allowTelegramRefresh = options?.allowTelegramRefresh !== false;
  const token = getAccessToken();
  if (token && (await probeMerchantMe(token))) return token;

  if (token) clearAccessToken();

  if (allowTelegramRefresh && (getTelegramWebApp() || getWebAppInitData())) {
    const refreshed = await refreshMerchantSessionFromTelegram();
    if (refreshed) return getAccessToken();
  }

  return null;
}

export function redirectToMerchantLogin(): void {
  if (typeof window === "undefined") return;
  clearAccessToken();
  const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
  window.location.replace(`/login?next=${next}`);
}

/** Telegram Mini App initData orqali JWT yangilash. */
export async function refreshMerchantSessionFromTelegram(shopId?: string | null): Promise<boolean> {
  const initData = await waitForWebAppInitData(2500);
  if (!initData) return false;

  const response = await fetch(apiUrl("/auth/telegram/webapp"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      init_data: initData,
      shop_id: shopId ?? resolveShopIdFromUrl(),
    }),
  });
  if (!response.ok) return false;

  const json = (await response.json()) as { token?: string; role?: string };
  if (json.role !== "merchant" || !json.token) return false;
  setAccessToken(json.token);
  return true;
}

/** Saqlashdan oldin token bor-yo'qligini tekshiradi; Telegram ichida avtomatik yangilaydi. */
export async function ensureMerchantSession(): Promise<void> {
  const token = await resolveMerchantSession();
  if (token) return;

  if (!getTelegramWebApp() && !getWebAppInitData() && !(await waitForWebAppInitData(1500))) {
    throw new Error("Kirish kerak — botda «CRM Panel» tugmasini qayta bosing");
  }

  throw new Error("Kirish yangilanmadi — Telegram orqali qayta oching");
}
