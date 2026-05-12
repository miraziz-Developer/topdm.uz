"use client";

import { useQuery } from "@tanstack/react-query";

import { searchProducts } from "@/lib/api";
import type { Product, SearchParams } from "@/types";


export function useProducts(params: SearchParams) {
  return useQuery({
    queryKey: ["products", params],
    queryFn: async () => {
      return await searchProducts(params);
    },
    staleTime: 15000,
  });
}
