import { merchantCrmUrl } from "@/lib/runtime-flags";
import { getTelegramWebApp } from "@/lib/telegram-webapp";

/** CRM sahifasiga o‘tish — Telegram WebApp ichida initData saqlanadi. */
export function buildMerchantCrmTelegramUrl(shopId?: string | null): string {
  const base = merchantCrmUrl();
  const path = "/telegram";
  if (!shopId) return `${base}${path}`;
  return `${base}${path}?shop_id=${encodeURIComponent(shopId)}`;
}

export function openMerchantCrm(shopId?: string | null): void {
  const url = buildMerchantCrmTelegramUrl(shopId);
  const tg = getTelegramWebApp();
  if (tg) {
    // Bir xil WebView — initData CRM /telegram sahifasida ishlaydi
    window.location.assign(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
