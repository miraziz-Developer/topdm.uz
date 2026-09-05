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

function deliver(event: MonitoringEvent): void {
  if (typeof window === "undefined") return;

  if (METRIKA_ID > 0 && typeof window.ym === "function") {
    window.ym(METRIKA_ID, "params", { monitoring: event });
  }

  if (!MONITORING_ENDPOINT) return;
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
    name: normalized.name || "Error",
    message: normalized.message.slice(0, 1000),
    stack: normalized.stack?.slice(0, 4000),
    digest,
    path: typeof window === "undefined" ? "unknown" : window.location.pathname,
    release: RELEASE,
    timestamp: new Date().toISOString(),
  });
}