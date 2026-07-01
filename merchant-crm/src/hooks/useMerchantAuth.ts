"use client";

import { useEffect, useState } from "react";

import { clearAccessToken } from "@/lib/auth";
import { redirectToMerchantLogin, resolveMerchantSession } from "@/lib/merchant-session";

type AuthState = "loading" | "authenticated" | "unauthenticated";

export function useMerchantAuth() {
  const [state, setState] = useState<AuthState>("loading");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await resolveMerchantSession();
      if (cancelled) return;
      if (!token) {
        setState("unauthenticated");
        redirectToMerchantLogin();
        return;
      }
      setState("authenticated");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = () => {
    clearAccessToken();
    window.location.href = "/login";
  };

  return {
    ready: state === "authenticated",
    loading: state === "loading",
    signOut,
  };
}
