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
