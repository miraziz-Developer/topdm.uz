/** Merchant can see approaching customers within this radius (km). */
export const MIN_APPROACH_RADIUS_KM = 1;
export const MAX_APPROACH_RADIUS_KM = 10;
export const DEFAULT_APPROACH_RADIUS_KM = 10;

export function clampApproachRadiusKm(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_APPROACH_RADIUS_KM;
  return Math.min(MAX_APPROACH_RADIUS_KM, Math.max(MIN_APPROACH_RADIUS_KM, Math.round(n)));
}
