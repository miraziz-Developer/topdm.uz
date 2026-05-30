"use client";

import { useEffect, useState } from "react";

import { clearAccessToken, getAccessToken } from "@/lib/auth";

type AuthState = "loading" | "authenticated" | "unauthenticated";

export function useMerchantAuth() {
  const [state, setState] = useState<AuthState>("loading");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setState("unauthenticated");
      window.location.replace("/login");
      return;
    }
    setState("authenticated");
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
