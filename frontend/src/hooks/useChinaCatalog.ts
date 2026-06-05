"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchChinaCatalog } from "@/lib/china-catalog";

export function useChinaCatalog(enabled: boolean, extraIds: string[] = []) {
  const extraKey = extraIds.length ? extraIds.join(",") : "";
  return useQuery({
    queryKey: ["china-catalog", extraKey],
    queryFn: () => fetchChinaCatalog(extraIds.length ? extraIds : undefined),
    staleTime: 120_000,
    enabled,
    retry: 1,
  });
}
