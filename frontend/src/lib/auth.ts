import type { AuthTokenResponse } from "@/lib/api";
import { useAuthStore, type AuthProfileMeta } from "@/stores/auth-store";

export function authMetaFromTokenResponse(res: AuthTokenResponse): AuthProfileMeta {
  return {
    id: res.id,
    role: res.role,
    display_name: res.display_name,
    email: res.email,
    telegram_id: res.telegram_id,
    phone: res.phone,
    has_email: res.has_email,
    has_telegram: res.has_telegram,
    shop_id: res.shop_id,
  };
}

/** Store JWT in HttpOnly cookie via Route Handler (never in localStorage). */
export async function establishSession(token: string): Promise<void> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    let detail = "Session yaratib bo'lmadi";
    try {
      const json = JSON.parse(raw) as { detail?: string };
      if (json.detail) detail = json.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
}

export async function clearSession(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  }).catch(() => undefined);
  useAuthStore.getState().clearSession();
}

export function setClientSession(meta: AuthProfileMeta): void {
  useAuthStore.getState().setSession(meta);
}

export function isAuthenticated(): boolean {
  return useAuthStore.getState().isLoggedIn;
}

/** @deprecated Use cookie session; kept for compatibility during migration. */
export function getAccessToken(): null {
  return null;
}

/** @deprecated JWT is stored in HttpOnly cookie via establishSession. */
export async function setAccessToken(token: string): Promise<void> {
  await establishSession(token);
}

/** @deprecated */
export async function clearAccessToken(): Promise<void> {
  await clearSession();
}

/** Cookie session — Authorization is attached server-side by the API proxy. */
export function authHeaders(): HeadersInit {
  return {};
}
