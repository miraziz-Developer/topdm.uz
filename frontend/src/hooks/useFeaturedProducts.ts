"use client";

import { useQuery } from "@tanstack/react-query";

import { getFeaturedProducts } from "@/lib/api";

export function useFeaturedProducts() {
  return useQuery({
    queryKey: ["featured-products"],
    queryFn: getFeaturedProducts,
    staleTime: 60_000,
  });
}
