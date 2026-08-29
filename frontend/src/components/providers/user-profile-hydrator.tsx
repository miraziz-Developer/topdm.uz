"use client";

import { useEffect } from "react";

import { useAuthStore } from "@/stores/auth-store";
import { useUserStore } from "@/stores/user-store";

export function UserProfileHydrator() {
  const refresh = useUserStore((state) => state.refresh);
  const markHydrated = useUserStore((state) => state.markHydrated);
  const authHydrated = useAuthStore((state) => state.hydrated);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  useEffect(() => {
    if (!authHydrated) return;
    if (!isLoggedIn) {
      // Guest: no session to fetch, but pages that gate on user-store
      // hydration (e.g. /orders guest lookup) must not wait forever.
      markHydrated();
      return;
    }
    void refresh();
  }, [authHydrated, isLoggedIn, refresh, markHydrated]);

  return null;
}
