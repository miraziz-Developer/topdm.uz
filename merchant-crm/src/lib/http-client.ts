/** Browser: same-origin `/api/v1` (Next proxy). SSR/dev: absolute backend URL. */
export function resolveApiBase(): string {
  const env = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (typeof window !== "undefined") {
    if (!env || env.startsWith("/")) return "/api/v1";
    return env.replace(/\/$/, "");
  }
  if (env && !env.startsWith("/")) return env.replace(/\/$/, "");
  return "http://127.0.0.1:8000/api/v1";
}

/** WebSocket host — prod: same origin (nginx `/ws/`). Dev: direct backend when CRM has no WS proxy. */
export function wsBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_WS_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    const backendOrigin = process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim();
    if (backendOrigin) {
      const url = new URL(backendOrigin);
      const protocol = url.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${url.host}`;
    }
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}`;
  }
  const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";
  const url = new URL(api.startsWith("/") ? `http://127.0.0.1:8000${api}` : api);
  const protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${url.host}`;
}
