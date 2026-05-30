const LOCALE_KEY = "bozor-locale";
const CURRENCY_KEY = "bozor-currency";

/** Headers forwarded to the API proxy for locale + currency conversion. */
export function getBozorClientHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const locale = localStorage.getItem(LOCALE_KEY) || "uz";
  const currency = localStorage.getItem(CURRENCY_KEY) || "UZS";
  return {
    "X-Bozor-Locale": locale,
    "X-Bozor-Currency": currency,
  };
}
