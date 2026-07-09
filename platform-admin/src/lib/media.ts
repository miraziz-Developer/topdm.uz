const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1").replace(/\/$/, "");

const API_ORIGIN = (() => {
  const base = API_BASE.startsWith("http") ? API_BASE : "http://localhost:8000/api/v1";
  try {
    return new URL(base).origin;
  } catch {
    return "http://localhost:8000";
  }
})();

const MEDIA_CDN = (process.env.NEXT_PUBLIC_MEDIA_CDN_URL ?? "").replace(/\/$/, "");

const PROD_MEDIA_HOSTS = new Set([
  "bozorliii.uz",
  "www.bozorliii.uz",
  "api.bozorliii.uz",
  "bozorliii.online",
  "www.bozorliii.online",
  "api.bozorliii.online",
  "crm.bozorliii.online",
  "admin.bozorliii.online",
  "media.bozorliii.online",
]);

function rewriteToMediaCdn(url: string): string {
  if (!MEDIA_CDN) return url;
  const match = url.match(/\/api\/v1\/media\/(.+)$/);
  if (match) return `${MEDIA_CDN}/${match[1]}`;
  return url;
}

function prodMediaApiOrigin(): string | null {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host.endsWith(".bozorliii.online") || host === "bozorliii.online") {
      return "https://api.bozorliii.online";
    }
    if (host.endsWith(".bozorliii.uz") || host === "bozorliii.uz") {
      return "https://api.bozorliii.uz";
    }
  }
  return null;
}

function resolveApiMediaForBrowser(resolved: string): string {
  if (!resolved.startsWith("/api/v1/media/")) return resolved;
  const apiOrigin = prodMediaApiOrigin();
  if (apiOrigin) return `${apiOrigin}${resolved}`;
  return resolved;
}

/** API media paths for admin banner/product previews. */
export function resolveMediaUrl(url?: string | null): string {
  const raw = (url ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("data:") || raw.startsWith("blob:")) return raw;
  if (raw.startsWith("/")) {
    if (raw.startsWith("/api/")) {
      const absolute = API_BASE.startsWith("http") ? `${API_ORIGIN}${raw}` : raw;
      return rewriteToMediaCdn(resolveApiMediaForBrowser(absolute));
    }
    return raw;
  }
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const parsed = new URL(raw);
      if (parsed.pathname.startsWith("/api/v1/media/") && PROD_MEDIA_HOSTS.has(parsed.hostname)) {
        const absolute = API_BASE.startsWith("http")
          ? `${API_ORIGIN}${parsed.pathname}`
          : parsed.pathname;
        return rewriteToMediaCdn(resolveApiMediaForBrowser(absolute));
      }
    } catch {
      /* keep */
    }
    return raw;
  }
  return rewriteToMediaCdn(resolveApiMediaForBrowser(`${API_ORIGIN}/${raw.replace(/^\//, "")}`));
}
