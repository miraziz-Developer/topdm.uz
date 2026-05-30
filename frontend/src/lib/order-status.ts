/** Bozor AI buyurtma holati — frontend va backend `reserved` bilan sinxron. */

export const ORDER_STATUS_PIPELINE = [
  "reserved",
  "confirmed",
  "preparing",
  "ready",
  "completed",
] as const;

export type OrderPipelineStatus = (typeof ORDER_STATUS_PIPELINE)[number];

export const ORDER_STATUS_LABELS: Record<string, string> = {
  reserved: "BRON QILINDI",
  pending: "BRON QILINDI",
  confirmed: "Tasdiqlandi",
  preparing: "Tayyorlanmoqda",
  ready: "Olib ketishga tayyor",
  completed: "Yakunlandi",
  cancelled: "Bekor qilindi",
};

/** Legacy `pending` pickup reservations map to pipeline index 0. */
export function normalizeOrderStatus(status: string): string {
  if (status === "pending") return "reserved";
  return status;
}

export function orderProgress(status: string): { pct: number; activeIndex: number } {
  const normalized = normalizeOrderStatus(status);
  if (normalized === "cancelled") return { pct: 0, activeIndex: -1 };
  const idx = ORDER_STATUS_PIPELINE.indexOf(normalized as OrderPipelineStatus);
  if (idx < 0) return { pct: 20, activeIndex: 0 };
  const pct = Math.round(((idx + 1) / ORDER_STATUS_PIPELINE.length) * 100);
  return { pct, activeIndex: idx };
}

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? ORDER_STATUS_LABELS[normalizeOrderStatus(status)] ?? status;
}
