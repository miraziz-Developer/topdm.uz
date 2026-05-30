/**
 * Production safety switches for demo/mock UI.
 * Set NEXT_PUBLIC_ALLOW_DEV_MOCKS=true only on local/staging if you need fallbacks.
 */
export function allowDevMocks(): boolean {
  if (process.env.NEXT_PUBLIC_ALLOW_DEV_MOCKS === "true") return true;
  return process.env.NODE_ENV !== "production";
}

export function merchantCrmUrl(): string {
  return (process.env.NEXT_PUBLIC_MERCHANT_CRM_URL ?? "https://crm.topdim.uz").replace(/\/$/, "");
}

/**
 * Click / Payme mijoz checkout — backend `ENABLE_ONLINE_CHECKOUT` bilan birga yoqing:
 * NEXT_PUBLIC_ENABLE_ONLINE_CHECKOUT=true
 */
export function allowOnlineCheckout(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_ONLINE_CHECKOUT === "true";
}
