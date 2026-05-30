export type BudgetHints = {
  min_price?: number;
  max_price?: number;
};

/** Uzbek/Latin typographic apostrophes → ASCII so regexes match "so'm" / "so'mgacha". */
function normalizeApostrophes(value: string) {
  return value.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035\u02BB\u02BC\u0060\u00B4\uFF07\u201D\u201C]/g, "'");
}

function digitsToNumber(value: string) {
  const normalized = value.replace(/\s/g, "");
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseBudgetFromQuery(text: string): BudgetHints {
  const normalized = normalizeApostrophes(text.toLowerCase());

  const mingGacha = normalized.match(/(\d+)\s*ming(?:\s*(?:so'?m|sum))?[^\d]{0,12}gacha/);
  if (mingGacha) {
    return { max_price: Number.parseInt(mingGacha[1], 10) * 1000 };
  }

  const mingDan = normalized.match(/(\d+)\s*ming(?:\s*(?:so'?m|sum))?\s*dan/);
  if (mingDan) {
    return { min_price: Number.parseInt(mingDan[1], 10) * 1000 };
  }

  // "100 000 so'mgacha" (bir so'z) yoki "100 000 so'm gacha"
  const somGachaMerged = normalized.match(/(\d[\d\s]{2,})\s*so'?mgacha/);
  if (somGachaMerged) {
    const max = digitsToNumber(somGachaMerged[1]);
    if (max !== null) return { max_price: max };
  }

  const spacedGacha = normalized.match(/(\d[\d\s]{2,})\s*(?:so'?m|sum)?\s*gacha/);
  if (spacedGacha) {
    const max = digitsToNumber(spacedGacha[1]);
    if (max !== null) return { max_price: max };
  }

  // Raqam + "gacha" (so'm yozilmasa ham)
  const digitsThenGacha = normalized.match(/(\d[\d\s]{2,})\s+gacha\b/);
  if (digitsThenGacha) {
    const max = digitsToNumber(digitsThenGacha[1]);
    if (max !== null) return { max_price: max };
  }

  const gachaPrefix = normalized.match(/gacha\s*(\d[\d\s]{2,})/);
  if (gachaPrefix) {
    const max = digitsToNumber(gachaPrefix[1]);
    if (max !== null) return { max_price: max };
  }

  const range = normalized.match(/(\d[\d\s]{2,})\s*(?:dan|-)\s*(\d[\d\s]{2,})/);
  if (range) {
    const min = digitsToNumber(range[1]);
    const max = digitsToNumber(range[2]);
    if (min !== null && max !== null) return { min_price: min, max_price: max };
  }

  const under = normalized.match(/(?:arzon|byudjet|budget)[^\d]{0,16}(\d[\d\s]{2,})/);
  if (under) {
    const max = digitsToNumber(under[1]);
    if (max !== null) return { max_price: max };
  }

  return {};
}
