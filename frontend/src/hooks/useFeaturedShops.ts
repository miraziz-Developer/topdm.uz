"use client";

import { useQuery } from "@tanstack/react-query";

import { getFeaturedShops } from "@/lib/api";

export function useFeaturedShops(marketSlug = "ippodrom") {
  return useQuery({
    queryKey: ["featured-shops", marketSlug],
    queryFn: () => getFeaturedShops({ market_slug: marketSlug }),
    staleTime: 60_000,
  });
}
