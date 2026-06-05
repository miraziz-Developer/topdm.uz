import type { AuthProfileMeta } from "@/stores/auth-store";
import type { AuthMeResponse } from "@/types";

import { readGuestPhone } from "@/lib/guest-phone";

export type ReviewAuthorContext = {
  authorName: string;
  phone: string | null;
  /** Sharh yuborish mumkin (profil yoki saqlangan telefon). */
  canSubmit: boolean;
  source: "profile" | "guest_phone" | "none";
};

function guestLabelFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 4) {
    return `Xaridor ·••${digits.slice(-4)}`;
  }
  return "Xaridor";
}

function nameFromProfile(profile: AuthMeResponse | null, meta: AuthProfileMeta | null): string | null {
  const display =
    profile?.display_name?.trim() ||
    meta?.display_name?.trim() ||
    null;
  if (display && display.length >= 2) return display;

  const email = profile?.email?.trim() || meta?.email?.trim();
  if (email && email.includes("@")) {
    const local = email.split("@")[0]?.trim();
    if (local && local.length >= 2) return local;
  }

  const tg = profile?.telegram_id ?? meta?.telegram_id;
  if (tg) return "Telegram foydalanuvchi";

  return null;
}

/** Sharh uchun ism va telefon — profil, sessiya yoki checkout telefonidan. */
export function resolveReviewAuthor(
  profile: AuthMeResponse | null,
  meta: AuthProfileMeta | null,
): ReviewAuthorContext {
  const phone =
    profile?.phone?.trim() ||
    meta?.phone?.trim() ||
    readGuestPhone()?.trim() ||
    null;

  const profileName = nameFromProfile(profile, meta);
  if (profileName) {
    return {
      authorName: profileName,
      phone,
      canSubmit: true,
      source: "profile",
    };
  }

  if (phone) {
    return {
      authorName: guestLabelFromPhone(phone),
      phone,
      canSubmit: true,
      source: "guest_phone",
    };
  }

  return {
    authorName: "",
    phone: null,
    canSubmit: false,
    source: "none",
  };
}
