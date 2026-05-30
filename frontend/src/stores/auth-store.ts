"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Non-sensitive profile metadata for instant UI (JWT lives in HttpOnly cookie only). */
export type AuthProfileMeta = {
  id: string;
  role: string;
  display_name: string | null;
  email: string | null;
  telegram_id: number | null;
  phone: string | null;
  has_email: boolean;
  has_telegram: boolean;
  shop_id: string | null;
};

type AuthStore = {
  isLoggedIn: boolean;
  meta: AuthProfileMeta | null;
  hydrated: boolean;
  setSession: (meta: AuthProfileMeta) => void;
  clearSession: () => void;
  markHydrated: () => void;
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      meta: null,
      hydrated: false,
      setSession: (meta) => set({ isLoggedIn: true, meta }),
      clearSession: () => set({ isLoggedIn: false, meta: null }),
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "bozor-auth-profile",
      partialize: (state) => ({
        isLoggedIn: state.isLoggedIn,
        meta: state.meta,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);

export function isLoggedInClient(): boolean {
  return useAuthStore.getState().isLoggedIn;
}
