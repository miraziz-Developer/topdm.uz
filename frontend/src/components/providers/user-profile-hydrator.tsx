"use client";

import { useEffect } from "react";

import { useAuthStore } from "@/stores/auth-store";
import { useUserStore } from "@/stores/user-store";

export function UserProfileHydrator() {
  const refresh = useUserStore((state) => state.refresh);
  const authHydrated = useAuthStore((state) => state.hydrated);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  useEffect(() => {
    if (!authHydrated || !isLoggedIn) return;
    void refresh();
  }, [authHydrated, isLoggedIn, refresh]);

  return null;
}
