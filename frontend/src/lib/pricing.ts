export const GROUP_MIN_MEMBERS = 2;
export const GROUP_DISCOUNT_RATE = 0.267;

export function getGroupPrice(singlePrice: number): number {
  return Math.round(singlePrice * (1 - GROUP_DISCOUNT_RATE));
}

export function getGroupSavings(singlePrice: number): number {
  return singlePrice - getGroupPrice(singlePrice);
}
