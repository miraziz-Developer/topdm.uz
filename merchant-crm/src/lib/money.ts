/** Merchant CRM — faqat so'm (ichki coin konvertatsiya yashirin). */

export const BALANCE_UZS_PER_COIN = 1_000;

export type MerchantWalletLike = {
  balance_uzs?: number;
  coin_balance?: number;
  coins_balance?: number;
};

export function walletBalanceUzs(wallet: MerchantWalletLike | null | undefined): number {
  if (!wallet) return 0;
  if (typeof wallet.balance_uzs === "number") return Math.max(0, wallet.balance_uzs);
  const coins = wallet.coin_balance ?? wallet.coins_balance ?? 0;
  return Math.max(0, coins * BALANCE_UZS_PER_COIN);
}

export function formatSom(amount: number): string {
  return `${new Intl.NumberFormat("uz-UZ").format(Math.round(amount))} so'm`;
}

export function canAffordSom(balanceUzs: number, priceUzs: number): boolean {
  return balanceUzs >= priceUzs;
}
