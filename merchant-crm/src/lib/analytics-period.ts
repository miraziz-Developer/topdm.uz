/** Merchant CRM statistika davrlari (kun / oy / yil). */

export type AnalyticsPeriodOption = {
  days: number;
  label: string;
  short: string;
};

export const ANALYTICS_PERIODS: AnalyticsPeriodOption[] = [
  { days: 7, label: "7 kun", short: "7 kun" },
  { days: 14, label: "14 kun", short: "14 kun" },
  { days: 30, label: "1 oy", short: "1 oy" },
  { days: 90, label: "3 oy", short: "3 oy" },
  { days: 180, label: "6 oy", short: "6 oy" },
  { days: 365, label: "1 yil", short: "1 yil" },
];

export function analyticsPeriodLabel(days: number): string {
  return ANALYTICS_PERIODS.find((p) => p.days === days)?.label ?? `${days} kun`;
}

export function analyticsGranularityHint(granularity?: string): string {
  if (granularity === "week") return "haftalik";
  if (granularity === "month") return "oylik";
  return "kunlik";
}
