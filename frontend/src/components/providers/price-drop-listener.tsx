"use client";

import { useEffect } from "react";

import { useToast } from "@/components/ui/toast";
import { formatPrice } from "@/lib/utils";
import { useWatchlistStore } from "@/stores/watchlist-store";

export function PriceDropListener() {
  const { push } = useToast();
  const recordView = useWatchlistStore((state) => state.recordView);
  const getDrop = useWatchlistStore((state) => state.getDrop);

  useEffect(() => {
    const onProductView = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; name: string; price: number; image?: string }>).detail;
      if (!detail) return;
      const drop = getDrop(detail);
      if (drop) {
        push(`${detail.name} ${formatPrice(drop.amount)} ga arzonladi`, "success");
      }
      recordView(detail);
    };

    window.addEventListener("bozor:product-view", onProductView as EventListener);
    return () => window.removeEventListener("bozor:product-view", onProductView as EventListener);
  }, [getDrop, push, recordView]);

  return null;
}

export function emitProductView(product: { id: string; name: string; price: number; image?: string }) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("bozor:product-view", { detail: product }));
}
