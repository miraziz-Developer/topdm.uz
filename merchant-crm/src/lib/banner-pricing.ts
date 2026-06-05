/** Bosh sahifa karusel banner — kun bo'yicha narx (backend bilan bir xil formula). */

export const BANNER_DAY_OPTIONS = [7, 14, 30, 60, 90] as const;
export type BannerDayOption = (typeof BANNER_DAY_OPTIONS)[number];

export type BannerTariffLike = {
  code: string;
  name_uz: string;
  reference_days?: number;
  reference_price_uzs?: number;
  price_per_day_uzs?: number;
  price_uzs?: number | null;
  duration_days?: number;
  carousel_slot?: number;
  priority_weight?: number;
  day_options?: number[];
};

export function bannerReferenceDays(t: BannerTariffLike): number {
  return Math.max(1, t.reference_days ?? t.duration_days ?? 30);
}

export function bannerReferencePrice(t: BannerTariffLike): number {
  return Math.max(0, t.reference_price_uzs ?? t.price_uzs ?? 0);
}

export function bannerPricePerDay(t: BannerTariffLike): number {
  if (t.price_per_day_uzs && t.price_per_day_uzs > 0) return t.price_per_day_uzs;
  const ref = bannerReferencePrice(t);
  const days = bannerReferenceDays(t);
  return ref > 0 ? Math.max(1, Math.round(ref / days)) : 0;
}

export function bannerPriceForDays(t: BannerTariffLike, days: number): { amountUzs: number; days: number } {
  const d = BANNER_DAY_OPTIONS.includes(days as BannerDayOption)
    ? days
    : Math.min(90, Math.max(7, days));
  const refDays = bannerReferenceDays(t);
  const refPrice = bannerReferencePrice(t);
  const amountUzs = Math.max(1, Math.round((refPrice * d) / refDays));
  return { amountUzs, days: d };
}

export function formatUzs(n: number): string {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n));
}
