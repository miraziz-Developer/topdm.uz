export type CurrencyCode = "UZS" | "USD" | "KZT" | "KGS" | "TJS";

export type CurrencyMeta = {
  code: CurrencyCode;
  symbol: string;
  label: string;
  rateFromUzs: number;
};

/** Static demo rates — override via NEXT_PUBLIC_FX_USD etc. in production use CBU API. */
export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  UZS: {
    code: "UZS",
    symbol: "so'm",
    label: "So'm",
    rateFromUzs: 1,
  },
  USD: {
    code: "USD",
    symbol: "$",
    label: "USD",
    rateFromUzs: Number(process.env.NEXT_PUBLIC_FX_USD) || 1 / 12_800,
  },
  KZT: {
    code: "KZT",
    symbol: "₸",
    label: "Tenge",
    rateFromUzs: Number(process.env.NEXT_PUBLIC_FX_KZT) || 1 / 28,
  },
  KGS: {
    code: "KGS",
    symbol: "с",
    label: "Som",
    rateFromUzs: Number(process.env.NEXT_PUBLIC_FX_KGS) || 1 / 145,
  },
  TJS: {
    code: "TJS",
    symbol: "SM",
    label: "Somoni",
    rateFromUzs: Number(process.env.NEXT_PUBLIC_FX_TJS) || 1 / 1_180,
  },
};

export function convertFromUzs(amountUzs: number, currency: CurrencyCode): number {
  const meta = CURRENCIES[currency];
  return amountUzs * meta.rateFromUzs;
}

export function formatMoney(amountUzs: number, currency: CurrencyCode, locale = "uz-UZ"): string {
  const value = convertFromUzs(amountUzs, currency);
  const meta = CURRENCIES[currency];
  if (currency === "UZS") {
    return `${new Intl.NumberFormat(locale).format(Math.round(value))} ${meta.symbol}`;
  }
  const digits = currency === "USD" ? 2 : 0;
  return `${meta.symbol}${new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)}`;
}
