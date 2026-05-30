"use client";

import { create } from "zustand";

import { getAuthMe } from "@/lib/api";
import { authMetaFromTokenResponse, clearSession, establishSession } from "@/lib/auth";
import { ApiError } from "@/lib/http-client";
import type { AuthMeResponse } from "@/types";
import { useAuthStore } from "@/stores/auth-store";

type UserState = {
  profile: AuthMeResponse | null;
  loading: boolean;
  hydrated: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

function metaFromProfile(profile: AuthMeResponse) {
  return {
    id: profile.id,
    role: profile.role,
    display_name: profile.display_name,
    email: profile.email,
    telegram_id: profile.telegram_id,
    phone: profile.phone,
    has_email: profile.has_email,
    has_telegram: profile.has_telegram,
    shop_id: profile.shop_id ?? null,
  };
}

export const useUserStore = create<UserState>((set) => ({
  profile: null,
  loading: false,
  hydrated: false,
  refresh: async () => {
    set({ loading: true });
    try {
      const profile = await getAuthMe();
      useAuthStore.getState().setSession(metaFromProfile(profile));
      set({ profile, loading: false, hydrated: true });
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 401 || status === 403) {
        await clearSession();
        set({ profile: null, loading: false, hydrated: true });
      } else {
        set((s) => ({ ...s, loading: false, hydrated: true }));
      }
    }
  },
  logout: async () => {
    await clearSession();
    set({ profile: null, hydrated: true });
  },
}));

/** Complete login after receiving JWT from backend auth endpoints. */
export async function completeAuthLogin(auth: Parameters<typeof authMetaFromTokenResponse>[0]) {
  await establishSession(auth.token);
  useAuthStore.getState().setSession(authMetaFromTokenResponse(auth));
}
