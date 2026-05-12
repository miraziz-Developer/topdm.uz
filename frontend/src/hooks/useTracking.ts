"use client";

import { useCallback } from "react";

import { trackEvent } from "@/lib/api";

export function useTracking() {
  const emit = useCallback(
    async (payload: {
      event_type: "view" | "lead" | "visit" | "share";
      product_id?: string;
      shop_id?: string;
      ref_token?: string;
      session_id?: string;
      metadata?: Record<string, unknown>;
    }) => {
      try {
        await trackEvent(payload);
      } catch {
        // Silent fail for tracking
      }
    },
    []
  );

  return { emit };
}
