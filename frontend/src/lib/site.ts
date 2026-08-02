/**
 * Yagona sayt konfiguratsiyasi — barcha domen/matn/URL env dan keladi.
 * Kelajakda domen o'zgarganda faqat NEXT_PUBLIC_SITE_URL env o'zgarishi yetarli.
 */

/** Sayt URL — env dan, fallback `bozorliii.online` (prod) yoki localhost (dev). */
export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (url) return url.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  return "https://bozorliii.online";
}

export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "/api/v1";
  return url.replace(/\/$/, "");
}

export function getMerchantCrmUrl(): string {
  const url = process.env.NEXT_PUBLIC_MERCHANT_CRM_URL?.trim();
  if (url) return url.replace(/\/$/, "");
  return "https://crm.bozorliii.online";
}

export function getMediaCdnUrl(): string {
  return (process.env.NEXT_PUBLIC_MEDIA_CDN_URL ?? "").replace(/\/$/, "");
}

/** Avtomatik domain (hostname) va display name qaytaradi. */
export function getSiteMeta() {
  const siteUrl = getSiteUrl();
  const domain = (() => {
    try {
      return new URL(siteUrl).hostname;
    } catch {
      return "bozorliii.online";
    }
  })();
  const displayName = domain.startsWith("www.")
    ? domain.slice(4)
    : domain;
  return { siteUrl, domain, displayName };
}
