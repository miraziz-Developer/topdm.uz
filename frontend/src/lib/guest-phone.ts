const STORAGE_KEY = "bozor_guest_phone";
const TOKEN_KEY = "bozor_guest_lookup_token";

export function saveGuestPhone(e164: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, e164);
  } catch {
    /* ignore */
  }
}

export function readGuestPhone(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveGuestLookupToken(phone: string, token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ phone, token }));
  } catch {
    /* ignore */
  }
}

export function readGuestLookupToken(phone: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { phone?: string; token?: string };
    if (parsed.phone === phone && parsed.token) return parsed.token;
    return null;
  } catch {
    return null;
  }
}
