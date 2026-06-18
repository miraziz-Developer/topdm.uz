import type { Product } from "@/types";

export type DomainCategoryId =
  | "all"
  | "erkaklar_kiyimi"
  | "ayollar_kiyimi"
  | "poyabzal"
  | "bolalar_kiyimi"
  | "aksesuarlar"
  | "matolar"
  | "gozallik"
  | "maishiy"
  | "boshqa";

export type DomainCategory = {
  id: DomainCategoryId;
  label: string;
};

export const DOMAIN_CATEGORIES: DomainCategory[] = [
  { id: "all", label: "Hammasi" },
  { id: "erkaklar_kiyimi", label: "Erkaklar kiyimi" },
  { id: "ayollar_kiyimi", label: "Ayollar kiyimi" },
  { id: "poyabzal", label: "Poyabzal" },
  { id: "bolalar_kiyimi", label: "Bolalar kiyimi" },
  { id: "aksesuarlar", label: "Aksessuarlar" },
  { id: "matolar", label: "Matolar" },
  { id: "gozallik", label: "Go'zallik" },
  { id: "maishiy", label: "Uy & maishiy" },
  { id: "boshqa", label: "Boshqa" },
];

const ROOT_LABELS: Record<Exclude<DomainCategoryId, "all">, string> = {
  erkaklar_kiyimi: "erkaklar kiyimi",
  ayollar_kiyimi: "ayollar kiyimi",
  poyabzal: "poyabzal",
  bolalar_kiyimi: "bolalar kiyimi",
  aksesuarlar: "aksesuarlar",
  matolar: "matolar",
  gozallik: "go'zallik",
  maishiy: "uy & maishiy",
  boshqa: "boshqa",
};

function normalize(value: string | undefined | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryChain(product: Product): string {
  return normalize(
    [
      product.root_category_name,
      product.root_category,
      product.category_name,
      product.category,
      product.sub_category,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/** Mahsulotning bitta asosiy kategoriyasi (filtr uchun). */
export function resolveProductDomainCategory(product: Product): DomainCategoryId | null {
  const chain = categoryChain(product);
  if (chain) {
    if (chain.includes("poyabzal") || chain.includes("tufli") || chain.includes("mokasen")) {
      return "poyabzal";
    }
    if (chain.includes("bolalar kiyimi") || chain.includes("chaqaloq")) {
      return "bolalar_kiyimi";
    }
    if (chain.includes("ayollar kiyimi") || chain.includes("ayollar poyabzali")) {
      return chain.includes("poyabzal") || chain.includes("tufli") ? "poyabzal" : "ayollar_kiyimi";
    }
    if (chain.includes("erkaklar kiyimi") || chain.includes("erkaklar poyabzali")) {
      return chain.includes("poyabzal") || chain.includes("tufli") ? "poyabzal" : "erkaklar_kiyimi";
    }
    if (chain.includes("aksessuar")) {
      return "aksesuarlar";
    }
    if (chain.includes("mato") || chain.includes("tekstil") || chain.includes("sarpo")) {
      return "matolar";
    }
    if (chain.includes("go'zallik") || chain.includes("atir") || chain.includes("parfyum") || chain.includes("kosmetika")) {
      return "gozallik";
    }
    if (
      chain.includes("elektronika") ||
      chain.includes("texnika") ||
      chain.includes("uy & maishiy") ||
      chain.includes("idish") ||
      chain.includes("oziq")
    ) {
      return "maishiy";
    }
  }

  const name = normalize(product.name);
  if (!name) return null;

  if (/\b(tuflisi|tufli|tufl|poyabzal|krossovk|sandal|mokasen|shippak|oyoq|shoes)\b/.test(name)) {
    return "poyabzal";
  }
  if (/\b(bolalar|chaqaloq|kids)\b/.test(name) && !/\bayollar\b/.test(name)) {
    return "bolalar_kiyimi";
  }
  if (/\b(erkaklar|erkak|jinsi|kostyum|rubashka)\b/.test(name)) {
    return "erkaklar_kiyimi";
  }
  if (
    /\b(ayollar|ayol|platye|yubka|bluzka|libos)\b/.test(name) &&
    !/\b(tufl|tufli|poyabzal|krossovk|sandal|mokasen|shippak)\b/.test(name)
  ) {
    return "ayollar_kiyimi";
  }
  if (/\b(aksessuar|sumka|belbog|shapka|sharf|soat)\b/.test(name)) {
    return "aksesuarlar";
  }
  if (/\b(mato|gazmol|atlas|pardabop|tekstil|sarpo)\b/.test(name)) {
    return "matolar";
  }
  if (/\b(atir|parfyum|kosmetika|krem)\b/.test(name)) {
    return "gozallik";
  }
  if (/\b(telefon|idish|tovoq|mikser|mebel|yong'oq|ziravor)\b/.test(name)) {
    return "maishiy";
  }

  return "boshqa";
}

export function productMatchesDomainCategory(product: Product, categoryId: DomainCategoryId): boolean {
  if (categoryId === "all") return true;

  const resolved = resolveProductDomainCategory(product);
  if (resolved) {
    return resolved === categoryId;
  }

  const chain = categoryChain(product);
  const name = normalize(product.name);
  const root = ROOT_LABELS[categoryId];

  if (chain.includes(root)) {
    return true;
  }

  switch (categoryId) {
    case "poyabzal":
      return /\b(tuflisi|tufli|tufl|poyabzal|krossovk|sandal|mokasen|shippak|oyoq|shoes)\b/.test(name);
    case "bolalar_kiyimi":
      return /\b(bolalar|chaqaloq|kids)\b/.test(name) || /\bbolalar\b/.test(chain);
    case "erkaklar_kiyimi":
      return /\b(erkaklar|erkak|jinsi|kostyum|rubashka)\b/.test(name);
    case "ayollar_kiyimi":
      return /\b(ayollar|ayol|platye|yubka|bluzka|libos)\b/.test(name) && !/\bbolalar\b/.test(chain);
    case "aksesuarlar":
      return /\b(aksessuar|sumka|belbog|shapka|sharf|soat)\b/.test(name);
    case "matolar":
      return /\b(mato|gazmol|atlas|pardabop|tekstil|sarpo)\b/.test(name) || chain.includes("mato");
    case "gozallik":
      return /\b(atir|parfyum|kosmetika)\b/.test(name) || chain.includes("atir");
    case "maishiy":
      return (
        /\b(telefon|idish|tovoq|mikser|mebel|yong'oq|ziravor|texnika)\b/.test(name) ||
        chain.includes("elektronika") ||
        chain.includes("uy & maishiy")
      );
    case "boshqa":
      return resolveProductDomainCategory(product) === "boshqa";
    default:
      return false;
  }
}

export function filterProductsByCategory(products: Product[], categoryId: DomainCategoryId): Product[] {
  if (categoryId === "all") return products;
  return products.filter((product) => productMatchesDomainCategory(product, categoryId));
}
