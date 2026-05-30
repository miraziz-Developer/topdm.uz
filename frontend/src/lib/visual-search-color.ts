/** Visual search detected color → UI filter chip (Aqlli filtrlar). */

const CANON_TO_UI: Record<string, string> = {
  sariq: "Sariq",
  qora: "Qora",
  oq: "Oq",
  "ko'k": "Ko'k",
  kok: "Ko'k",
  qizil: "Qizil",
  yashil: "Yashil",
  bej: "Bej",
  pushti: "Pushti",
};

const UI_TO_SEARCH: Record<string, string[]> = {
  Sariq: ["sariq", "yellow"],
  Qora: ["qora", "black"],
  Oq: ["oq", "white"],
  "Ko'k": ["ko'k", "kok", "blue"],
  Qizil: ["qizil", "red"],
  Yashil: ["yashil", "green"],
  Bej: ["bej", "beige"],
};

export function detectedColorToFilterLabel(color?: string | null): string | null {
  if (!color?.trim()) return null;
  const key = color.trim().toLowerCase();
  return CANON_TO_UI[key] ?? null;
}

export function colorFilterMatchesProduct(uiColor: string, productName: string, category?: string): boolean {
  const haystack = `${productName} ${category ?? ""}`.toLowerCase();
  const terms = UI_TO_SEARCH[uiColor] ?? [uiColor.toLowerCase()];
  return terms.some((t) => haystack.includes(t));
}
