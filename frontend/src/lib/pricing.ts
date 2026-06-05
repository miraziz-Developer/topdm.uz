export const GROUP_MIN_MEMBERS = 2;
/** Fallback — runtime da `/platform/pricing-rules` dan yangilanadi. */
export const GROUP_DISCOUNT_RATE = 0.267;

export function getGroupPrice(singlePrice: number, rate: number = GROUP_DISCOUNT_RATE): number {
  return Math.round(singlePrice * (1 - rate));
}

export function getGroupSavings(singlePrice: number): number {
  return singlePrice - getGroupPrice(singlePrice);
}
