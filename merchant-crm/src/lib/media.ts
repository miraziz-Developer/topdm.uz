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

/** API media paths (stories, reels, products) for browser playback. */
export function resolveMediaUrl(url?: string | null): string {
  const raw = (url ?? "").trim();
  if (!raw) return "";
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
      /* keep */
    }
    return raw;
  }
  return `${API_ORIGIN}/${raw.replace(/^\//, "")}`;
}

function resolveApiMediaForBrowser(resolved: string): string {
  if (!resolved.startsWith("/api/v1/media/")) return resolved;
  const apiOrigin = mediaApiOriginForBrowser();
  if (apiOrigin) return `${apiOrigin}${resolved}`;
  return resolved;
}

/** Reels — Telegram WebView uchun to‘g‘ridan-to‘g‘ri API host (Range). */
export function resolveReelVideoUrl(url?: string | null): string {
  const resolved = resolveMediaUrl(url);
  if (!resolved) return "";
  return resolveApiMediaForBrowser(resolved);
}

export function resolveReelPosterUrl(url?: string | null): string {
  const resolved = resolveMediaUrl(url);
  if (!resolved) return "";
  return resolveApiMediaForBrowser(resolved);
}
