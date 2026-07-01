"use client";

import { useQuery } from "@tanstack/react-query";

import { searchProducts } from "@/lib/api";
import type { Product, SearchParams } from "@/types";


export function useProducts(params: SearchParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["products", params],
    queryFn: async () => {
      return await searchProducts(params);
    },
    staleTime: 15000,
    enabled: options?.enabled ?? true,
    retry: 1,
  });
}
