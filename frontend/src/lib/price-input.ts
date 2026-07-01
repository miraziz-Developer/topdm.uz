/** O'zbekcha narx maydoni: "10 000", "2 000 000" → son */

export function parseUzPriceInput(raw: string): number | null {
  const cleaned = raw.replace(/[\s,_]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export function formatUzPriceInput(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  const n = Number(digits);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("uz-UZ");
}

export function normalizePriceRange(
  minRaw: string,
  maxRaw: string,
): { min: number | null; max: number | null; minSwapped: boolean } {
  let min = parseUzPriceInput(minRaw);
  let max = parseUzPriceInput(maxRaw);
  let minSwapped = false;
  if (min !== null && max !== null && min > max) {
    [min, max] = [max, min];
    minSwapped = true;
  }
  return { min, max, minSwapped };
}
