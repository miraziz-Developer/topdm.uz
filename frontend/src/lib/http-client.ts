export type ApiErrorPayload = {
  detail?: string | { message?: string; code?: string };
  error?: string | { message?: string; code?: string };
  request_id?: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly requestId?: string;
  readonly code?: string;

  constructor(message: string, status: number, requestId?: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
    this.code = code;
  }
}

type ErrorNotifier = (message: string, status: number) => void;

let errorNotifier: ErrorNotifier | null = null;

export function registerApiErrorNotifier(notifier: ErrorNotifier | null): void {
  errorNotifier = notifier;
}

export function parseApiErrorBody(status: number, raw: string): ApiError {
  if (!raw) return new ApiError(`So'rov muvaffaqiyatsiz (${status})`, status);

  try {
    const json = JSON.parse(raw) as ApiErrorPayload;
    const requestId = json.request_id;
    const d = json.detail ?? json.error;

    if (typeof d === "string") {
      return new ApiError(d, status, requestId);
    }
    if (d && typeof d === "object") {
      const message =
        typeof d.message === "string"
          ? d.message
          : typeof d.code === "string"
            ? d.code
            : `So'rov muvaffaqiyatsiz (${status})`;
      return new ApiError(message, status, requestId, typeof d.code === "string" ? d.code : undefined);
    }
  } catch {
    /* plain text */
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith("<") || trimmed.toLowerCase().includes("<html")) {
    if (status === 502) {
      return new ApiError("Server vaqtincha javob bermadi. Birozdan keyin qayta urinib ko'ring.", status);
    }
    if (status === 504) {
      return new ApiError("So'rov vaqti tugadi. Filtrlarni soddalashtirib qayta urinib ko'ring.", status);
    }
    return new ApiError(`So'rov muvaffaqiyatsiz (${status})`, status);
  }

  return new ApiError(raw.slice(0, 240), status);
}

/**
 * Same-origin API base — requests hit Next.js `/api/v1/*` proxy which forwards
 * to the FastAPI backend and attaches the HttpOnly session cookie as Bearer.
 */
import { getBozorClientHeaders } from "@/lib/client-context";

const CONFIGURED_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";

/**
 * Browser must call the same-origin `/api/v1` proxy so the HttpOnly `bozor_session`
 * cookie is sent. If `NEXT_PUBLIC_API_BASE_URL` points at FastAPI directly (e.g.
 * `http://127.0.0.1:8000/api/v1`), `/auth/me` would 401 and the UI would loop on "login required".
 */
export function resolveBrowserApiBaseUrl(): string {
  if (typeof window === "undefined") return CONFIGURED_API_BASE;
  if (CONFIGURED_API_BASE.startsWith("http://") || CONFIGURED_API_BASE.startsWith("https://")) {
    return "/api/v1";
  }
  return CONFIGURED_API_BASE;
}

export const API_BASE_URL = CONFIGURED_API_BASE;

export type ApiFetchOptions = RequestInit & {
  /** When true, proxy attaches session cookie as Authorization (server-side). */
  auth?: boolean;
  timeoutMs?: number;
  silent?: boolean;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { auth: _auth = false, timeoutMs = 0, silent = false, headers: initHeaders, ...rest } = options;

  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  const headers = new Headers(initHeaders ?? undefined);
  for (const [key, value] of Object.entries(getBozorClientHeaders())) {
    if (!headers.has(key)) headers.set(key, value);
  }
  if (!headers.has("Content-Type") && rest.body && !(rest.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  try {
    const base = resolveBrowserApiBaseUrl();
    const response = await fetch(`${base}${normalizedPath}`, {
      ...rest,
      headers,
      credentials: "include",
      signal: controller.signal,
    });

    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      const apiError = parseApiErrorBody(response.status, raw);
      if (!silent && errorNotifier) {
        errorNotifier(apiError.message, apiError.status);
      }
      throw apiError;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      const timeoutError = new ApiError("So'rov vaqti tugadi. Qayta urinib ko'ring.", 408);
      if (!silent && errorNotifier) errorNotifier(timeoutError.message, 408);
      throw timeoutError;
    }
    if (err instanceof ApiError) throw err;
    const devHint =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
        ? " Docker ishlatilsa http://localhost:3002, backend http://localhost:8000/health ni tekshiring."
        : typeof window !== "undefined" &&
            (window.location.hostname === "bozorliii.online" ||
              window.location.hostname.endsWith(".bozorliii.online"))
          ? " DNS yangilanishi kerak — Terminalda: sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder. Yoki tarmoq DNS ni 8.8.8.8 qiling va brauzerni qayta oching."
          : " Internet yoki server holatini tekshiring.";
    const networkError = new ApiError(
      typeof window !== "undefined"
        ? `Serverga ulanib bo'lmadi. Sahifani yangilang.${devHint}`
        : "Serverga ulanib bo'lmadi. Internet yoki backendni tekshiring.",
      0,
    );
    if (!silent && errorNotifier) errorNotifier(networkError.message, 0);
    throw networkError;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
