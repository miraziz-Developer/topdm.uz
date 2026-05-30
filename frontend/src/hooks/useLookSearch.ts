"use client";

import { useQuery } from "@tanstack/react-query";

import { searchProductsLook } from "@/lib/api";

export function useLookSearch(query: string, enabled: boolean) {
  const q = query.trim();
  return useQuery({
    queryKey: ["look-search", q],
    queryFn: () => searchProductsLook(q),
    enabled: enabled && q.length >= 2,
    staleTime: 60_000,
  });
}
