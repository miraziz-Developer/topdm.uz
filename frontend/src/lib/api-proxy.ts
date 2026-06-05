/** Shared helpers for Next.js → FastAPI API proxy routes. */

export const PROXY_HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

export const PROXY_FORWARD_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "content-type",
  "range",
  "if-range",
  "if-modified-since",
  "if-none-match",
  "x-request-id",
  "x-bozor-locale",
  "x-bozor-currency",
  "authorization",
] as const;

export function isMediaProxyPath(pathSegments: string[]): boolean {
  return pathSegments[0] === "media";
}

export function shouldStreamProxyResponse(
  pathSegments: string[],
  contentType: string,
): boolean {
  if (pathSegments[0] === "chat") return true;
  const ct = contentType.toLowerCase();
  if (ct.startsWith("video/") || ct.startsWith("audio/")) return true;
  if (isMediaProxyPath(pathSegments) && ct.startsWith("image/")) return true;
  return ct.includes("text/event-stream") || ct.includes("application/x-ndjson");
}

export function filterProxyResponseHeaders(source: Headers): Headers {
  const headers = new Headers();
  source.forEach((value, key) => {
    if (PROXY_HOP_BY_HOP.has(key.toLowerCase())) return;
    headers.set(key, value);
  });
  return headers;
}
