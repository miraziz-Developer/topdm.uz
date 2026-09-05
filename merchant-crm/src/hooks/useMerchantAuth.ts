"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { clearAccessToken } from "@/lib/auth";
import { resolveMerchantSession } from "@/lib/merchant-session";

type AuthState = "loading" | "authenticated" | "unauthenticated";

export function useMerchantAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>("loading");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await resolveMerchantSession().catch(() => null);
      if (cancelled) return;
      if (!token) {
        setState("unauthenticated");
        router.replace("/login");
        return;
      }
      setState("authenticated");
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const signOut = () => {
    clearAccessToken();
    router.replace("/login");
  };

  return {
    ready: state === "authenticated",
    loading: state === "loading",
    signOut,
  };
}
