/** Bosh sahifa karusel banner — psixologik paket narxlari (backend bilan bir xil). */

export const BANNER_DAY_OPTIONS = [1, 3, 7, 30] as const;
export type BannerDayOption = (typeof BANNER_DAY_OPTIONS)[number];

export const BANNER_DAY_LABELS: Record<BannerDayOption, string> = {
  1: "1 kun",
  3: "3 kun",
  7: "1 hafta",
  30: "1 oy",
};

const TIER_EXTRA_DAILY: Record<BannerDayOption, number> = {
  1: 1.0,
  3: 0.5,
  7: 0.65,
  30: 1.75,
};

const PREV_TIER: Partial<Record<BannerDayOption, BannerDayOption>> = {
  3: 1,
  7: 3,
  30: 7,
};

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
  tier_prices_uzs?: Record<string, number>;
};

function roundPsychPrice(amount: number): number {
  if (amount >= 50_000) return Math.max(5_000, Math.round(amount / 5_000) * 5_000);
  if (amount >= 10_000) return Math.max(1_000, Math.round(amount / 1_000) * 1_000);
  return Math.max(1_000, Math.round(amount / 500) * 500);
}

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

export function bannerTierPrices(t: BannerTariffLike): Record<BannerDayOption, number> {
  const fromApi = t.tier_prices_uzs;
  if (fromApi) {
    const mapped = {} as Record<BannerDayOption, number>;
    for (const d of BANNER_DAY_OPTIONS) {
      const v = fromApi[String(d)];
      if (typeof v === "number" && v > 0) mapped[d] = v;
    }
    if (BANNER_DAY_OPTIONS.every((d) => mapped[d] > 0)) return mapped;
  }

  const daily = bannerPricePerDay(t);
  const p1 = roundPsychPrice(daily * TIER_EXTRA_DAILY[1]);
  const p3 = roundPsychPrice(p1 + daily * TIER_EXTRA_DAILY[3]);
  const p7 = roundPsychPrice(p3 + daily * TIER_EXTRA_DAILY[7]);
  const p30 = roundPsychPrice(p7 + daily * TIER_EXTRA_DAILY[30]);
  return { 1: p1, 3: p3, 7: p7, 30: p30 };
}

export function normalizeBannerDays(days: number, fallback: BannerDayOption = 7): BannerDayOption {
  if (BANNER_DAY_OPTIONS.includes(days as BannerDayOption)) return days as BannerDayOption;
  if (days < 1) return 1;
  if (days > 30) return 30;
  return BANNER_DAY_OPTIONS.reduce((best, opt) =>
    Math.abs(opt - days) < Math.abs(best - days) ? opt : best,
  fallback);
}

export function bannerDayLabel(days: number): string {
  return BANNER_DAY_LABELS[days as BannerDayOption] ?? `${days} kun`;
}

export function bannerPriceForDays(
  t: BannerTariffLike,
  days: number,
): { amountUzs: number; days: BannerDayOption; effectivePerDay: number } {
  const normalized = normalizeBannerDays(days);
  const prices = bannerTierPrices(t);
  const amountUzs = Math.max(1, prices[normalized]);
  return {
    amountUzs,
    days: normalized,
    effectivePerDay: Math.max(1, Math.round(amountUzs / normalized)),
  };
}

export function bannerTierUpsell(
  t: BannerTariffLike,
  days: number,
): { deltaUzs: number; prevLabel: string } | null {
  const normalized = normalizeBannerDays(days);
  const prev = PREV_TIER[normalized];
  if (!prev) return null;
  const prices = bannerTierPrices(t);
  return {
    deltaUzs: Math.max(0, prices[normalized] - prices[prev]),
    prevLabel: BANNER_DAY_LABELS[prev],
  };
}

export function formatUzs(n: number): string {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n));
}
