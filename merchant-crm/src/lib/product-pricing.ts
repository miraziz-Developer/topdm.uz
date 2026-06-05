/** Do'konchi bazaviy narx → mijoz ko'radigan narx (backend bilan bir xil formula). */
const DEFAULT_MARKUP_PCT = 15;

export function customerSalePriceUzs(merchantBaseUzs: number, markupPct = DEFAULT_MARKUP_PCT): number {
  const base = Math.max(0, Math.floor(merchantBaseUzs));
  if (base <= 0) return 0;
  return Math.ceil(base * (1 + markupPct / 100));
}

export function formatUzs(amount: number): string {
  return new Intl.NumberFormat("uz-UZ").format(amount) + " so'm";
}
