"use client";

import { useEffect, useRef } from "react";

import { useToast } from "@/components/ui/toast";
import { getOrderNotifications } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

/** Yangi buyurtma holati — toast + qo'ng'iroqcha pulse uchun. */
export function OrderNotificationsListener() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const { push } = useToast();
  const seenIds = useRef<Set<string>>(new Set());
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (!hydrated || !isLoggedIn) return;

    const poll = async () => {
      try {
        const res = await getOrderNotifications(true);
        const items = res.items ?? [];
        if (!bootstrapped.current) {
          for (const item of items) seenIds.current.add(item.id);
          bootstrapped.current = true;
          return;
        }
        for (const item of items) {
          if (seenIds.current.has(item.id)) continue;
          seenIds.current.add(item.id);
          push(`${item.title} — ${item.product_name}`, item.highlight ? "success" : "info");
        }
      } catch {
        // ignore
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 45_000);
    return () => window.clearInterval(timer);
  }, [hydrated, isLoggedIn, push]);

  return null;
}
