const STORAGE_KEY = "bozor_guest_phone";

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
