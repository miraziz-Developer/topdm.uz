"use client";

import { useQuery } from "@tanstack/react-query";

import { loadHomeDealFeed } from "@/lib/home-product-feed";

export function useHomeDealFeed(limit = 16) {
  return useQuery({
    queryKey: ["home-deal-feed", limit],
    queryFn: () => loadHomeDealFeed(limit),
    staleTime: 45_000,
    refetchOnWindowFocus: true,
  });
}

/** @deprecated use useHomeDealFeed */
export function useLightningDeals() {
  const q = useHomeDealFeed(16);
  return {
    ...q,
    data: q.data ? { items: q.data.lightning } : undefined,
  };
}

/** @deprecated use useHomeDealFeed */
export function useClearanceDeals() {
  const q = useHomeDealFeed(16);
  return {
    ...q,
    data: q.data ? { items: q.data.clearance } : undefined,
  };
}
