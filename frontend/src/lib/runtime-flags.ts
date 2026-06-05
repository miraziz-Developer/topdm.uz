/**
 * Production safety switches for demo/mock UI.
 * Set NEXT_PUBLIC_ALLOW_DEV_MOCKS=true only on local/staging if you need fallbacks.
 */
export function allowDevMocks(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.NEXT_PUBLIC_ALLOW_DEV_MOCKS === "false") return false;
  if (process.env.NEXT_PUBLIC_ALLOW_DEV_MOCKS === "true") return true;
  return true;
}

/**
 * Do'kon vitrinasi + story demo (API bo'sh bo'lsa).
 * Prod: NEXT_PUBLIC_DEMO_FAKE_DATA=true
 */
export function allowDemoFakeData(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_FAKE_DATA === "true") return true;
  if (process.env.NEXT_PUBLIC_DEMO_FAKE_DATA === "false") return false;
  return allowDevMocks();
}

export function merchantCrmUrl(): string {
  return (process.env.NEXT_PUBLIC_MERCHANT_CRM_URL ?? "https://crm.bozorliii.uz").replace(/\/$/, "");
}

/**
 * Click / Payme mijoz checkout — backend `ENABLE_ONLINE_CHECKOUT` bilan birga yoqing:
 * NEXT_PUBLIC_ENABLE_ONLINE_CHECKOUT=true
 */
export function allowOnlineCheckout(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_ONLINE_CHECKOUT === "true";
}

/**
 * Xitoy (Taobao) bozori — hozircha o'chiq, faqat mahalliy bozor.
 * Yoqish: NEXT_PUBLIC_ENABLE_CHINA_MARKET=true
 */
export function isChinaMarketEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_CHINA_MARKET === "true";
}
