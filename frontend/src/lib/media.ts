export const PLACEHOLDER_IMAGE = "/brand/topdim-product-placeholder.svg";
export const PLACEHOLDER_CLOTHING = "/brand/topdim-product-placeholder.svg";
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

const PROD_MEDIA_HOSTS = new Set(["topdim.uz", "www.topdim.uz", "api.topdim.uz"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export function productImage(images?: string[] | null, index = 0): string {
  const picked = images?.[index] || images?.[0];
  const url = resolveMediaUrl(picked);
  return url === PLACEHOLDER_IMAGE || url === "/placeholder.svg" ? PLACEHOLDER_CLOTHING : url;
}

export function hasProductImage(images?: string[] | null): boolean {
  const raw = (images?.[0] ?? "").trim();
  return Boolean(raw);
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
