"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getMyOrders, lookupOrdersByPhone } from "@/lib/api";
import { readGuestLookupToken, readGuestPhone } from "@/lib/guest-phone";
import { isActiveOrder, sortOrdersNewestFirst } from "@/lib/order-filters";
import { ORDERS_REFRESH_EVENT } from "@/lib/orders-refresh-bus";
import { UZ_PHONE_E164_REGEX } from "@/utils/phone-mask";
import type { Order } from "@/types";

const POLL_ACTIVE_MS = 15_000;
const POLL_IDLE_MS = 45_000;

function ordersFingerprint(orders: Order[]): string {
  return orders
    .map(
      (o) =>
        `${o.id}:${o.status}:${o.updated_at ?? ""}:${o.payment_status ?? ""}:${o.pickup_date ?? ""}:${o.pickup_time ?? ""}`,
    )
    .join("|");
}

async function fetchMergedOrders(params: {
  isLoggedIn: boolean;
  apiScope: "active" | "completed" | "cancelled" | "all";
  guestPhone?: string;
  guestVerificationToken?: string;
}): Promise<Order[]> {
  const { isLoggedIn, apiScope, guestPhone, guestVerificationToken } = params;

  if (isLoggedIn) {
    const mine = await getMyOrders(apiScope);
    let items = sortOrdersNewestFirst(mine.items ?? []);
    const saved = readGuestPhone();
    if (saved && UZ_PHONE_E164_REGEX.test(saved)) {
      const token = readGuestLookupToken(saved);
      if (token) {
        try {
          const guest = await lookupOrdersByPhone(saved, token);
          const byId = new Map<string, Order>();
          for (const o of items) byId.set(o.id, o);
          for (const o of guest.items ?? []) byId.set(o.id, o);
          items = sortOrdersNewestFirst(Array.from(byId.values()));
        } catch {
          // guest merge optional for logged-in users
        }
      }
    }
    return items;
  }

  if (guestPhone && guestVerificationToken) {
    const guest = await lookupOrdersByPhone(guestPhone, guestVerificationToken);
    return sortOrdersNewestFirst(guest.items ?? []);
  }

  return [];
}

export type UseMyOrdersListOptions = {
  enabled: boolean;
  isLoggedIn: boolean;
  apiScope?: "active" | "completed" | "cancelled" | "all";
  guestPhone?: string;
  guestVerificationToken?: string;
  profilePhone?: string | null;
};

export function useMyOrdersList({
  enabled,
  isLoggedIn,
  apiScope = "all",
  guestPhone,
  guestVerificationToken,
  profilePhone,
}: UseMyOrdersListOptions) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fingerprintRef = useRef("");
  const hasActiveRef = useRef(false);
  const loadingRef = useRef(false);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!enabled || loadingRef.current) return;
      loadingRef.current = true;
      const silent = opts?.silent ?? false;
      try {
        const items = await fetchMergedOrders({
          isLoggedIn,
          apiScope,
          guestPhone,
          guestVerificationToken,
        });
        const fp = ordersFingerprint(items);
        if (fp !== fingerprintRef.current) {
          fingerprintRef.current = fp;
          setOrders(items);
        }
        hasActiveRef.current = items.some((o) => isActiveOrder(o.status));
        if (!items.length) {
          if (isLoggedIn) {
            setError(
              profilePhone
                ? "Buyurtma topilmadi. Checkout telefoni profil telefoni bilan bir xil ekanini tekshiring."
                : "Profilga telefon qo'shing — buyurtmalar shu raqam bilan bog'lanadi.",
            );
          } else {
            setError("Bu telefon uchun buyurtma topilmadi.");
          }
        } else {
          setError(null);
        }
      } catch {
        if (!silent) {
          setError(isLoggedIn ? "Buyurtmalarni yuklab bo'lmadi." : "Sessiya tugagan. SMS kod bilan qayta tasdiqlang.");
        }
      } finally {
        loadingRef.current = false;
        if (!silent) setLoading(false);
      }
    },
    [enabled, isLoggedIn, apiScope, guestPhone, guestVerificationToken, profilePhone],
  );

  const reload = useCallback(async () => {
    await load({ silent: true });
  }, [load]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fingerprintRef.current = "";
    void load();
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      const delay = hasActiveRef.current ? POLL_ACTIVE_MS : POLL_IDLE_MS;
      timer = setTimeout(() => {
        if (cancelled) return;
        void load({ silent: true }).finally(() => {
          if (!cancelled) schedule();
        });
      }, delay);
    };

    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return;
    const onRefresh = () => void load({ silent: true });
    window.addEventListener(ORDERS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(ORDERS_REFRESH_EVENT, onRefresh);
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void load({ silent: true });
    };
    const onFocus = () => void load({ silent: true });
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, load]);

  return { orders, setOrders, loading, error, setError, reload };
}
