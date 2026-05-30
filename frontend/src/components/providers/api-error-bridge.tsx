"use client";

import { useEffect } from "react";

import { useToast } from "@/components/ui/toast";
import { registerApiErrorNotifier } from "@/lib/http-client";

/**
 * Registers a global API error → toast bridge for all apiFetch calls.
 */
export function ApiErrorBridge() {
  const { push } = useToast();

  useEffect(() => {
    registerApiErrorNotifier((message, status) => {
      if (status === 401) return;
      push(message, "error");
    });
    return () => registerApiErrorNotifier(null);
  }, [push]);

  return null;
}
