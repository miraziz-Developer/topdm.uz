export const COIN_UZS_RATE = 1_000;
export const EARN_UZS_PER_COIN = 10_000;
export const MAX_REDEEM_ORDER_FRACTION = 0.3;

export function coinsForPurchaseAmount(totalUzs: number): number {
  return Math.max(1, Math.floor(totalUzs / EARN_UZS_PER_COIN));
}

export function maxRedeemableCoins(balance: number, orderTotalUzs: number): number {
  if (balance < 1 || orderTotalUzs < 1) return 0;
  const byTotal = Math.floor(orderTotalUzs / COIN_UZS_RATE);
  const byCap = Math.floor((orderTotalUzs * MAX_REDEEM_ORDER_FRACTION) / COIN_UZS_RATE);
  return Math.max(0, Math.min(balance, byTotal, byCap));
}
