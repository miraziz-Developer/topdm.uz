/** Bosh sahifa karusel banner — soat bo‘yicha narx (har qanday soat tanlash mumkin). */

export type BannerTariffLike = {
  code: string;
  name_uz: string;
  priority_weight?: number;
  carousel_slot?: number;
  /** Soat narxi so‘mda (backenddan keladi). */
  price_uzs_hourly?: number | null;
  /** Kuniga necha soat ko‘rsatiladi (default 24). */
  hours_per_day?: number | null;
};

function roundPrice(amount: number): number {
  if (amount >= 50_000) return Math.max(5_000, Math.round(amount / 5_000) * 5_000);
  if (amount >= 10_000) return Math.max(1_000, Math.round(amount / 1_000) * 1_000);
  return Math.max(1_000, Math.round(amount / 500) * 500);
}

export function bannerPricePerHour(t: BannerTariffLike): number {
  const hourly = t.price_uzs_hourly ?? 0;
  if (hourly > 0) return hourly;
  // Fallback: oylik narx / 30 kun / 24 soat
  return 0;
}

export function bannerPriceForHours(
  t: BannerTariffLike,
  hours: number,
): { amountUzs: number; hours: number; effectivePerHour: number } {
  const effectiveHours = Math.max(1, Math.round(hours));
  const pricePerHour = Math.max(0, bannerPricePerHour(t));
  const amountUzs = roundPrice(effectiveHours * pricePerHour);
  return {
    amountUzs,
    hours: effectiveHours,
    effectivePerHour: amountUzs > 0 && effectiveHours > 0 ? Math.round(amountUzs / effectiveHours) : 0,
  };
}

export function bannerHoursLabel(hours: number): string {
  const h = Math.max(1, Math.round(hours));
  if (h === 1) return "1 soat";
  if (h === 24) return "1 kun";
  if (h === 48) return "2 kun";
  if (h === 72) return "3 kun";
  if (h === 168) return "1 hafta";
  if (h === 720) return "1 oy";
  if (h < 24) return `${h} soat`;
  const days = Math.floor(h / 24);
  const rem = h % 24;
  if (rem === 0) return `${days} kun`;
  return `${days} kun ${rem} soat`;
}

export function formatUzs(n: number): string {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n));
}
