import type { Product } from "@/types";

export type DomainCategoryId =
  | "all"
  | "erkaklar_kiyimi"
  | "ayollar_kiyimi"
  | "poyabzal"
  | "bolalar_kiyimi"
  | "aksesuarlar";

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
];

function haystack(product: Product): string {
  const attrs = typeof product.category === "string" ? product.category : "";
  return `${product.name} ${attrs} ${product.shop?.name ?? ""}`.toLowerCase();
}

export function filterProductsByCategory(products: Product[], categoryId: DomainCategoryId): Product[] {
  if (categoryId === "all") return products;

  return products.filter((product) => {
    const hay = haystack(product);
    switch (categoryId) {
      case "erkaklar_kiyimi":
        return /erkaklar|erkak|jinsi|kostyum|ko['']ylak|charm kurt|shim|jun kozok/.test(hay);
      case "ayollar_kiyimi":
        return /ayollar|ayol|palto|platye|ko['']ylak|atlas|bahoriy/.test(hay) && !/bolalar/.test(hay);
      case "poyabzal":
        return /poyabzal|krossovk|oyoq|shoes|sandal/.test(hay);
      case "bolalar_kiyimi":
        return /bolalar|bola|kids|6–12|6-12|sport kostyum/.test(hay);
      case "aksesuarlar":
        return /aksessuar|belbog|shapka|sharf|sumka/.test(hay) && !/krossovk|poyabzal/.test(hay);
      default:
        return true;
    }
  });
}
