type MetricRating = "good" | "needs-improvement" | "poor";

export type BrowserMetric = {
  id: string;
  name: string;
  value: number;
  delta: number;
  rating: MetricRating;
  navigationType?: string;
};

type MonitoringEvent = {
  type: "web-vital" | "client-error";
  name: string;
  value?: number;
  rating?: MetricRating;
  message?: string;
  stack?: string;
  digest?: string;
  path: string;
  release?: string;
  timestamp: string;
};

declare global {
  interface Window {
    ym?: (counterId: number, action: string, ...args: unknown[]) => void;
  }
}

const METRIKA_ID = Number(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || 0);
const MONITORING_ENDPOINT = process.env.NEXT_PUBLIC_MONITORING_ENDPOINT?.trim();
const RELEASE = process.env.NEXT_PUBLIC_RELEASE?.trim();

const SECRET_VALUE_PATTERN = /\b(authorization|cookie|password|passwd|secret|token|api[-_]?key)(\s*[:=]\s*)([^\s,;]+)/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?<!\d)(?:\+?998[\s-]?)?(?:\d[\s-]?){9}(?!\d)/g;
const URL_PATTERN = /https?:\/\/[^\s)\]}>'"]+/gi;

function stripUrlDetails(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "[redacted-url]";
  }
}

export function sanitizeMonitoringText(value: string, maxLength: number): string {
  return value
    .replace(URL_PATTERN, stripUrlDetails)
    .replace(SECRET_VALUE_PATTERN, "$1$2[redacted]")
    .replace(BEARER_PATTERN, "Bearer [redacted]")
    .replace(JWT_PATTERN, "[redacted-token]")
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(PHONE_PATTERN, "[redacted-phone]")
    .slice(0, maxLength);
}

function isAllowedMonitoringEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint, window.location.origin);
    return url.protocol === "https:" || url.origin === window.location.origin;
  } catch {
    return false;
  }
}

function deliver(event: MonitoringEvent): void {
  if (typeof window === "undefined") return;

  if (METRIKA_ID > 0 && typeof window.ym === "function") {
    window.ym(METRIKA_ID, "params", { monitoring: event });
  }

  if (!MONITORING_ENDPOINT || !isAllowedMonitoringEndpoint(MONITORING_ENDPOINT)) return;
  const body = JSON.stringify(event);
  if (navigator.sendBeacon) {
    navigator.sendBeacon(MONITORING_ENDPOINT, new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch(MONITORING_ENDPOINT, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    credentials: "omit",
  }).catch(() => undefined);
}

export function reportWebVital(metric: BrowserMetric): void {
  deliver({
    type: "web-vital",
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    path: window.location.pathname,
    release: RELEASE,
    timestamp: new Date().toISOString(),
  });
}

export function reportClientError(error: unknown, digest?: string): void {
  const normalized = error instanceof Error ? error : new Error(String(error));
  deliver({
    type: "client-error",
    name: sanitizeMonitoringText(normalized.name || "Error", 120),
    message: sanitizeMonitoringText(normalized.message, 1000),
    stack: normalized.stack ? sanitizeMonitoringText(normalized.stack, 4000) : undefined,
    digest: digest ? sanitizeMonitoringText(digest, 200) : undefined,
    path: typeof window === "undefined" ? "unknown" : window.location.pathname,
    release: RELEASE,
    timestamp: new Date().toISOString(),
  });
}