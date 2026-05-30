/** Local stylist preferences sent with each chat turn. */

export type StylistClientProfile = {
  size?: string;
  favorite_colors?: string[];
  locale?: string;
};

const STORAGE_KEY = "bozor-stylist-profile";

export function loadStylistProfile(): StylistClientProfile {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StylistClientProfile;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveStylistProfile(patch: StylistClientProfile): StylistClientProfile {
  const current = loadStylistProfile();
  const next = { ...current, ...patch };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function stylistProfileForApi(locale: string): StylistClientProfile {
  const p = loadStylistProfile();
  return {
    size: p.size,
    favorite_colors: p.favorite_colors,
    locale: p.locale || locale,
  };
}
