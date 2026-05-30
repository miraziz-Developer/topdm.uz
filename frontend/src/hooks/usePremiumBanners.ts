"use client";

import { useQuery } from "@tanstack/react-query";

import { getPremiumBanners } from "@/lib/api";

export function usePremiumBanners(limit = 24) {
  return useQuery({
    queryKey: ["premium-banners", limit],
    queryFn: () => getPremiumBanners(limit),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
