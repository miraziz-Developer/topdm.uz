"use client";

import { useQuery } from "@tanstack/react-query";

import { getShopDashboard } from "@/lib/api";

type DashboardResponse = {
  stats: {
    total_products: number;
    total_leads: number;
    total_views: number;
    total_visits: number;
  };
  leads: Array<{
    id: string;
    customer_phone: string;
    customer_name?: string;
    status: string;
    ref_token?: string;
  }>;
};

export function useShopDashboard(shopId: string) {
  return useQuery({
    queryKey: ["shop-dashboard", shopId],
    queryFn: () => getShopDashboard(shopId) as Promise<DashboardResponse>,
    enabled: Boolean(shopId),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
