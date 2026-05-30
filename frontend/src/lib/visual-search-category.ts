/** Map localized visual-search UI labels to canonical DB category slugs. */

export const VISUAL_CATEGORY_LABEL_MAP: Record<string, string> = {
  Bot: "shoes",
  bot: "shoes",
  "Oyoq kiyim": "shoes",
  Kurtka: "jacket",
  kurtka: "jacket",
  Svitch: "top",
  svitch: "top",
  Sviter: "top",
  "Yuqori kiyim": "top",
  "Ayollar kechki libos": "dress",
  "Ayollar kechki libos (platye)": "dress",
  "Shim / bel": "pants",
  Futbolka: "top",
  "Ko'ylak": "shirt",
};

export function mapVisualCategoryLabel(rawLabel: string, fallbackCategory?: string): string {
  const trimmed = rawLabel.trim();
  if (VISUAL_CATEGORY_LABEL_MAP[trimmed]) {
    return VISUAL_CATEGORY_LABEL_MAP[trimmed];
  }
  const lower = trimmed.toLowerCase();
  if (VISUAL_CATEGORY_LABEL_MAP[lower]) {
    return VISUAL_CATEGORY_LABEL_MAP[lower];
  }
  if (fallbackCategory?.trim()) {
    const cat = fallbackCategory.trim().toLowerCase();
    if (cat && cat !== "kiyim" && cat !== "unknown") {
      return cat;
    }
  }
  return lower || "top";
}
