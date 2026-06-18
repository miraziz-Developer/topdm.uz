import { clearAccessToken, getAccessToken, setAccessToken } from "@/lib/auth";
import { resolveApiBase } from "@/lib/http-client";
import { getWebAppInitData, waitForWebAppInitData } from "@/lib/telegram-webapp";

function apiUrl(path: string): string {
  return `${resolveApiBase()}${path}`;
}

function resolveShopIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("shop_id");
}

async function probeMerchantMe(token: string): Promise<boolean> {
  const response = await fetch(apiUrl("/merchant/me"), {
    method: "GET",
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.ok;
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
  const token = getAccessToken();
  if (token && (await probeMerchantMe(token))) return;

  if (token) clearAccessToken();

  if (!getWebAppInitData() && !(await waitForWebAppInitData(1500))) {
    throw new Error("Kirish kerak — botda «CRM Panel» tugmasini qayta bosing");
  }

  const refreshed = await refreshMerchantSessionFromTelegram();
  if (!refreshed) {
    throw new Error("Kirish yangilanmadi — Telegram orqali qayta oching");
  }
}
