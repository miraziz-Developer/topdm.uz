export type SizeGroup = "clothing" | "shoes" | "pants" | "kids" | "accessories" | "default";

export const SIZE_PRESET_GROUPS: Record<SizeGroup, string[]> = {
  clothing: ["XS", "S", "M", "L", "XL", "XXL"],
  shoes: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"],
  pants: ["28", "29", "30", "31", "32", "33", "34", "36", "38"],
  kids: ["2Y", "4Y", "6Y", "8Y", "10Y", "12Y", "14Y"],
  accessories: ["Bitta o'lcham", "S", "M", "L"],
  default: ["S", "M", "L", "XL"],
};

export const SIZE_GROUP_LABELS: Record<SizeGroup, string> = {
  clothing: "Kiyim",
  shoes: "Poyabzal",
  pants: "Shim",
  kids: "Bolalar",
  accessories: "Aksessuar",
  default: "Umumiy",
};

export const SIZE_GROUP_HINTS: Record<SizeGroup, string> = {
  clothing: "S, M, L, XL",
  shoes: "36–45 (EU)",
  pants: "Bel razmeri",
  kids: "Yosh bo'yicha",
  accessories: "Bitta o'lcham / S–L",
  default: "S–XL",
};

/** Guruh tanlash UI — poyabzal kiyimdan oldin. */
export const SIZE_GROUP_OPTIONS: SizeGroup[] = ["clothing", "shoes", "pants", "kids", "accessories"];

const GROUP_MATCHERS: Array<{ group: SizeGroup; tokens: string[] }> = [
  {
    group: "shoes",
    tokens: [
      "poyabzal",
      "oyoq kiyim",
      "oyoqkiyim",
      "krossovka",
      "krossovk",
      "tufli",
      "mokasen",
      "sandal",
      "shippak",
      "baletka",
      "kalish",
      "papuch",
      "slipper",
      "sneaker",
      "loafer",
      "shoes",
      "footwear",
      "poyabzali",
    ],
  },
  { group: "pants", tokens: ["shim", "jinsi", "short", "belbog"] },
  { group: "kids", tokens: ["bolalar kiyimi", "chaqaloq", "maktab formasi", "bolalar"] },
  { group: "accessories", tokens: ["sumka", "aksessuar", "kamar", "sharf", "shapka", "soat", "atir", "kosmetika"] },
  {
    group: "clothing",
    tokens: ["kiyim", "koylak", "ko'ylak", "kurtka", "futbolka", "mayka", "libos", "yubka", "bluzka", "palto"],
  },
];

export function sizeGroupForCategoryHint(hint?: string | null): SizeGroup {
  const key = (hint ?? "").trim().toLowerCase();
  if (!key) return "default";
  for (const { group, tokens } of GROUP_MATCHERS) {
    for (const token of tokens) {
      if (key.includes(token)) return group;
    }
  }
  return "default";
}

export function sizePresetsForCategoryHint(hint?: string | null): string[] {
  const group = sizeGroupForCategoryHint(hint);
  return [...SIZE_PRESET_GROUPS[group]];
}

export function sizePresetsForGroup(group: SizeGroup): string[] {
  return [...SIZE_PRESET_GROUPS[group]];
}
