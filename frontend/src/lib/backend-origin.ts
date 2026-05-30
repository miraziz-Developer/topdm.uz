/** Public origin of the FastAPI service (WebSocket, direct media in dev). */
export function publicBackendOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.replace(/\/$/, "");
  if (explicit) return explicit;

  const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";
  if (api.startsWith("http://") || api.startsWith("https://")) {
    return api.replace(/\/api\/v1\/?$/, "");
  }

  return "http://127.0.0.1:8000";
}
