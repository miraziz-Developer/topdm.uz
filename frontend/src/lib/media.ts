export const PLACEHOLDER_IMAGE = "/brand/bozorliii-product-placeholder.svg";
export const PLACEHOLDER_CLOTHING = "/brand/bozorliii-product-placeholder.svg";
export const PLACEHOLDER_BOUTIQUE = "/placeholder-boutique.svg";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1").replace(/\/$/, "");

const API_ORIGIN = (() => {
  const base = API_BASE.startsWith("http") ? API_BASE : "http://localhost:8000/api/v1";
  try {
    return new URL(base).origin;
  } catch {
    return "http://localhost:8000";
  }
})();

const PROD_MEDIA_HOSTS = new Set([
  "bozorliii.uz",
  "www.bozorliii.uz",
  "api.bozorliii.uz",
  "bozorliii.online",
  "www.bozorliii.online",
  "api.bozorliii.online",
  "crm.bozorliii.online",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mediaApiOriginForBrowser(): string | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return null;
  if (host === "crm.bozorliii.online" || host.endsWith(".bozorliii.online")) {
    return "https://api.bozorliii.online";
  }
  if (host.endsWith(".bozorliii.uz")) {
    return "https://api.bozorliii.uz";
  }
  return null;
}

/** Turn API-relative media paths into absolute URLs the browser can load. */
export function resolveMediaUrl(url?: string | null): string {
  const raw = (url ?? "").trim();
  if (!raw) return PLACEHOLDER_IMAGE;
  if (raw.startsWith("data:") || raw.startsWith("blob:")) return raw;
  if (raw.startsWith("/")) {
    if (raw.startsWith("/api/")) {
      if (!API_BASE.startsWith("http")) return raw;
      return `${API_ORIGIN}${raw}`;
    }
    return raw;
  }
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const parsed = new URL(raw);
      if (parsed.pathname.startsWith("/api/v1/media/") && PROD_MEDIA_HOSTS.has(parsed.hostname)) {
        if (!API_BASE.startsWith("http")) return parsed.pathname;
        return `${API_ORIGIN}${parsed.pathname}`;
      }
    } catch {
      /* keep absolute url */
    }
    return raw;
  }
  return `${API_ORIGIN}/${raw.replace(/^\//, "")}`;
}

function resolveApiMediaUrlForBrowser(resolved: string): string {
  if (!resolved.startsWith("/api/v1/media/")) return resolved;
  const apiOrigin = mediaApiOriginForBrowser();
  if (apiOrigin) return `${apiOrigin}${resolved}`;
  return resolved;
}

/** Reels video — Range qo‘llab-quvvatlash uchun prod da API subdomain. */
export function resolveReelVideoUrl(url?: string | null): string {
  const resolved = resolveMediaUrl(url);
  if (!resolved || resolved === PLACEHOLDER_IMAGE) return "";
  return resolveApiMediaUrlForBrowser(resolved);
}

/** Reels poster / logo — prod da API host (asosiy saytda buzuk img oldini oladi). */
export function resolveReelPosterUrl(url?: string | null): string {
  const resolved = resolveMediaUrl(url);
  if (!resolved || resolved === PLACEHOLDER_IMAGE) return "";
  return resolveApiMediaUrlForBrowser(resolved);
}

/** Eski seed / tasodifiy placeholder — mahsulotga mos emas. */
export function isUnreliableProductImage(url?: string | null): boolean {
  const u = (url ?? "").trim().toLowerCase();
  if (!u) return true;
  if (u.includes("images.unsplash.com")) return true;
  if (u.includes("picsum.photos")) return true;
  if (u.includes("loremflickr.com") || u.includes("placehold.co")) return true;
  if (u.includes("/placeholder") && !u.includes("bozorliii-product-placeholder")) return true;
  return false;
}

export function hasReliableProductImage(images?: string[] | null): boolean {
  const raw = (images?.[0] ?? "").trim();
  return Boolean(raw) && !isUnreliableProductImage(raw);
}

export function productImage(images?: string[] | null, index = 0): string {
  const picked = images?.[index] || images?.[0];
  if (!picked?.trim() || isUnreliableProductImage(picked)) {
    return PLACEHOLDER_CLOTHING;
  }
  const url = resolveMediaUrl(picked);
  return url === PLACEHOLDER_IMAGE || url === "/placeholder.svg" ? PLACEHOLDER_CLOTHING : url;
}

export function hasProductImage(images?: string[] | null): boolean {
  return hasReliableProductImage(images);
}

export function isLocalDevMedia(url: string): boolean {
  try {
    const host = new URL(url, "http://localhost").hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

export function isUuidLike(value?: string | null): boolean {
  return Boolean(value && UUID_RE.test(value.trim()));
}
