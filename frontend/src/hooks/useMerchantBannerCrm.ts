"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  buyCrmBannerWithCoins,
  createCrmBanner,
  generatePaymentInvoice,
  getCoinPackages,
  getCrmCarouselSettings,
  getCrmBannerStats,
  patchCrmCarouselSettings,
  purchaseCrmBanner,
  getCrmBannerTariffs,
  getCrmMerchantWallet,
  getCrmMyBanners,
  renewCrmBanner,
  verifyCrmBannerPayment,
} from "@/lib/api";

export function useCrmBannerTariffs() {
  return useQuery({
    queryKey: ["crm-banner-tariffs"],
    queryFn: getCrmBannerTariffs,
    staleTime: 120_000,
  });
}

export function useCrmMerchantWallet() {
  return useQuery({
    queryKey: ["crm-merchant-wallet"],
    queryFn: getCrmMerchantWallet,
    staleTime: 30_000,
  });
}

export function useCrmMyBanners() {
  return useQuery({
    queryKey: ["crm-my-banners"],
    queryFn: getCrmMyBanners,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useCrmBannerStats(bannerId: string | null) {
  return useQuery({
    queryKey: ["crm-banner-stats", bannerId],
    queryFn: () => getCrmBannerStats(bannerId!),
    enabled: Boolean(bannerId),
    staleTime: 10_000,
    refetchInterval: 20_000,
  });
}

export function useCrmCarouselSettings() {
  return useQuery({
    queryKey: ["crm-carousel-settings"],
    queryFn: getCrmCarouselSettings,
    staleTime: 30_000,
  });
}

export function useCoinPackages() {
  return useQuery({
    queryKey: ["coin-packages"],
    queryFn: getCoinPackages,
    staleTime: 120_000,
  });
}

export function useCrmBannerMutations() {
  const qc = useQueryClient();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["crm-my-banners"] });
    void qc.invalidateQueries({ queryKey: ["crm-merchant-wallet"] });
    void qc.invalidateQueries({ queryKey: ["premium-banners"] });
  };

  const create = useMutation({
    mutationFn: createCrmBanner,
    onSuccess: invalidate,
  });

  const verify = useMutation({
    mutationFn: verifyCrmBannerPayment,
    onSuccess: (_data, vars) => {
      invalidate();
      void qc.invalidateQueries({ queryKey: ["crm-banner-stats", vars.banner_id] });
    },
  });

  const renew = useMutation({
    mutationFn: renewCrmBanner,
    onSuccess: invalidate,
  });

  const buyWithCoins = useMutation({
    mutationFn: purchaseCrmBanner,
    onSuccess: invalidate,
  });

  const topUp = useMutation({
    mutationFn: generatePaymentInvoice,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["crm-merchant-wallet"] });
    },
  });

  const saveCarousel = useMutation({
    mutationFn: patchCrmCarouselSettings,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["crm-carousel-settings"] });
      void qc.invalidateQueries({ queryKey: ["premium-banners"] });
    },
  });

  return { create, verify, renew, buyWithCoins, topUp, saveCarousel };
}
